import type { TablighDatabase } from "../db/database.js";
import { sendReleaseNotifications } from "../notifications/notifier.js";
import { stageCdpDraft } from "../transports/cdp-draft.js";
import { publishViaOfficialApi } from "../transports/official-api.js";
import type {
  JobStatus,
  PlatformId,
  PlatformJobRecord,
  PlatformTarget,
  PublishBundle,
  ValidationReport,
} from "../types.js";
import { enrichBundleWithUtm } from "./utm.js";
import { resolveEffectiveTransport, validateBundle } from "./validator.js";

export const ALLOWED_TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  PLANNED: ["VALIDATED", "FAILED"],
  VALIDATED: ["UPLOADING", "FAILED"],
  UPLOADING: ["SCHEDULED", "PENDING_HUMAN_CLICK", "PUBLISHED", "FAILED"],
  SCHEDULED: ["PUBLISHED", "FAILED"],
  PENDING_HUMAN_CLICK: ["PUBLISHED", "FAILED"],
  PUBLISHED: [],
  FAILED: ["PLANNED", "VALIDATED"],
};

export function canTransition(from: JobStatus, to: JobStatus): boolean {
  return from === to || ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertValidTransition(from: JobStatus, to: JobStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal job transition: ${from} -> ${to}`);
  }
}

export interface PlanResult {
  valid: boolean;
  bundle: PublishBundle;
  report: ValidationReport;
  jobs: PlatformJobRecord[];
}

export interface PlanOptions {
  skipUtm?: boolean;
  checkFilesOnDisk?: boolean;
  baseDir?: string;
}

/**
 * Enriches a PublishBundle with edge-funnel UTM parameters, runs deterministic
 * validation against platform rules & existing published hashes, and persists
 * validated jobs into SQLite.
 */
export function planBundle(
  db: TablighDatabase,
  rawBundle: PublishBundle,
  options: PlanOptions = {},
): PlanResult {
  const bundle = options.skipUtm ? rawBundle : enrichBundleWithUtm(rawBundle);
  const existingPublishedHashes = db.getPublishedHashes(bundle.episodeId);
  const report = validateBundle(bundle, {
    existingPublishedHashes,
    checkFilesOnDisk: options.checkFilesOnDisk ?? true,
    baseDir: options.baseDir,
  });

  if (!report.valid) {
    return {
      valid: false,
      bundle,
      report,
      jobs: [],
    };
  }

  const { jobs } = db.upsertEpisodeAndJobs(bundle, { initialStatus: "PLANNED" });
  const validatedJobs: PlatformJobRecord[] = [];

  for (const job of jobs) {
    if (job.status === "PLANNED" || job.status === "FAILED") {
      validatedJobs.push(
        db.transitionJobStatus(
          job.id,
          "VALIDATED",
          { lastError: null },
          "Passed deterministic pre-flight validation",
        ),
      );
    } else {
      validatedJobs.push(job);
    }
  }

  return {
    valid: true,
    bundle,
    report,
    jobs: validatedJobs,
  };
}

export interface RunJobResult {
  jobId: number;
  episodeId: string;
  platform: PlatformId;
  format: string;
  action: "executed" | "skipped_idempotent" | "skipped_pending_human" | "failed_validation";
  status: JobStatus;
  publishedUrl?: string | null;
  stagingPath?: string | null;
  studioUrl?: string | null;
  message: string;
}

export interface RunPipelineOptions {
  episodeId?: string;
  only?: PlatformId[];
  dryRun?: boolean;
  demoMode?: boolean;
  stagingDir?: string;
  dashboardUrl?: string;
  checkFilesOnDisk?: boolean;
  baseDir?: string;
  env?: NodeJS.ProcessEnv;
  fetchFn?: typeof fetch;
  notify?: boolean;
}

export interface RunPipelineSummary {
  dryRun: boolean;
  processedCount: number;
  results: RunJobResult[];
}

/**
 * Executes pending jobs through the Hybrid Dual-Transport state machine:
 * - Official API channels -> SCHEDULED or PUBLISHED
 * - High-risk CDP channels (TikTok, IG w/ trending audio) -> PENDING_HUMAN_CLICK
 * - Duplicate content hashes or already-published jobs -> skipped idempotently
 */
export async function runPipeline(
  db: TablighDatabase,
  options: RunPipelineOptions = {},
): Promise<RunPipelineSummary> {
  const dryRun = options.dryRun ?? false;
  const demoMode = options.demoMode ?? false;
  const env = options.env ?? process.env;
  const fetchFn = options.fetchFn ?? fetch;
  const stagingDir = options.stagingDir ?? env.TABLIGH_STAGING_DIR ?? "./data/staging";
  const dashboardUrl = options.dashboardUrl ?? env.TABLIGH_DASHBOARD_URL ?? "http://localhost:8791";
  const onlySet = options.only && options.only.length > 0 ? new Set(options.only) : null;

  const jobs = db.listJobs({ episodeId: options.episodeId }).filter((job) =>
    onlySet ? onlySet.has(job.platform) : true,
  );

  const results: RunJobResult[] = [];
  const touchedEpisodes = new Set<string>();

  for (const initialJob of jobs) {
    let job = initialJob;

    // Idempotency guard for already active/terminal states
    if (job.status === "PUBLISHED" || job.status === "SCHEDULED") {
      results.push({
        jobId: job.id,
        episodeId: job.episodeId,
        platform: job.platform,
        format: job.format,
        action: "skipped_idempotent",
        status: job.status,
        publishedUrl: job.publishedUrl,
        message: `Already ${job.status}; skipped re-upload idempotently.`,
      });
      continue;
    }

    // Physical Approval Gate invariant: never auto-publish a pending human click job
    if (job.status === "PENDING_HUMAN_CLICK") {
      results.push({
        jobId: job.id,
        episodeId: job.episodeId,
        platform: job.platform,
        format: job.format,
        action: "skipped_pending_human",
        status: job.status,
        stagingPath: job.stagingPath,
        studioUrl: job.studioUrl,
        message: "Awaiting human operator click to publish (Physical Approval Gate).",
      });
      continue;
    }

    // Idempotency guard against identical content_hash published/scheduled in another episode
    const duplicate = db.findPublishedOrScheduledByHash(job.platform, job.contentHash, job.id);
    if (duplicate) {
      results.push({
        jobId: job.id,
        episodeId: job.episodeId,
        platform: job.platform,
        format: job.format,
        action: "skipped_idempotent",
        status: job.status,
        publishedUrl: duplicate.publishedUrl,
        message: `Idempotency guard: identical content hash (${job.contentHash.slice(0, 12)}) already ${duplicate.status} in ${duplicate.episodeId}.`,
      });
      continue;
    }

    const target = JSON.parse(job.payloadJson) as PlatformTarget;
    const episode = db.getEpisode(job.episodeId);

    // Ensure job reaches VALIDATED if starting from PLANNED or FAILED
    if (job.status === "PLANNED" || job.status === "FAILED") {
      const miniBundle: PublishBundle = {
        schemaVersion: "1.0",
        episodeId: job.episodeId,
        title: episode?.title ?? job.episodeId,
        pillar: episode?.pillar ?? "Tabligh",
        sourceType: episode?.sourceType ?? "manual",
        targets: [target],
      };
      const validation = validateBundle(miniBundle, {
        existingPublishedHashes: db.getPublishedHashes(job.episodeId),
        checkFilesOnDisk: options.checkFilesOnDisk ?? false,
        baseDir: options.baseDir,
      });
      if (!validation.valid) {
        const msg = validation.errors.map((e) => e.message).join("; ");
        job = db.transitionJobStatus(job.id, "FAILED", { lastError: msg }, msg);
        results.push({
          jobId: job.id,
          episodeId: job.episodeId,
          platform: job.platform,
          format: job.format,
          action: "failed_validation",
          status: job.status,
          message: msg,
        });
        touchedEpisodes.add(job.episodeId);
        continue;
      }
      job = db.transitionJobStatus(job.id, "VALIDATED", { lastError: null }, "Validated before execution");
    }

    const effectiveTransport = resolveEffectiveTransport(target);
    job = db.transitionJobStatus(
      job.id,
      "UPLOADING",
      { transport: effectiveTransport, lastError: null },
      `Starting ${effectiveTransport} dispatch${dryRun ? " (dry-run)" : ""}`,
    );

    if (effectiveTransport === "cdp_draft") {
      const cdpOutcome = await stageCdpDraft({
        episodeId: job.episodeId,
        target,
        stagingDir,
        dryRun,
        env,
        fetchFn,
      });

      job = db.transitionJobStatus(
        job.id,
        "PENDING_HUMAN_CLICK",
        {
          stagingPath: cdpOutcome.stagingPath,
          studioUrl: cdpOutcome.studioUrl,
          lastError: null,
        },
        cdpOutcome.message,
      );

      results.push({
        jobId: job.id,
        episodeId: job.episodeId,
        platform: job.platform,
        format: job.format,
        action: "executed",
        status: job.status,
        stagingPath: job.stagingPath,
        studioUrl: job.studioUrl,
        message: cdpOutcome.message,
      });
      touchedEpisodes.add(job.episodeId);
      continue;
    }

    const apiOutcome = await publishViaOfficialApi({
      episodeId: job.episodeId,
      target,
      dryRun: dryRun || demoMode,
      env,
      fetchFn,
    });

    if (!apiOutcome.ok || apiOutcome.outcome === "FAILED") {
      job = db.transitionJobStatus(
        job.id,
        "FAILED",
        { lastError: apiOutcome.error ?? apiOutcome.message },
        apiOutcome.message,
      );
      results.push({
        jobId: job.id,
        episodeId: job.episodeId,
        platform: job.platform,
        format: job.format,
        action: "executed",
        status: job.status,
        message: apiOutcome.message,
      });
      touchedEpisodes.add(job.episodeId);
      continue;
    }

    const nextStatus: JobStatus = apiOutcome.outcome === "SCHEDULED" ? "SCHEDULED" : "PUBLISHED";
    job = db.transitionJobStatus(
      job.id,
      nextStatus,
      {
        publishedUrl: apiOutcome.publishedUrl ?? null,
        externalId: apiOutcome.externalId ?? null,
        lastError: null,
      },
      apiOutcome.message,
    );

    results.push({
      jobId: job.id,
      episodeId: job.episodeId,
      platform: job.platform,
      format: job.format,
      action: "executed",
      status: job.status,
      publishedUrl: job.publishedUrl,
      message: apiOutcome.message,
    });
    touchedEpisodes.add(job.episodeId);
  }

  if (options.notify !== false && !dryRun && touchedEpisodes.size > 0) {
    for (const episodeId of touchedEpisodes) {
      await sendReleaseNotifications(db, episodeId, {
        dashboardUrl,
        env,
        fetchFn,
      });
    }
  }

  return {
    dryRun,
    processedCount: results.length,
    results,
  };
}
