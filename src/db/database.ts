import fs from "node:fs";
import path from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { computeContentHash, resolveEffectiveTransport } from "../core/validator.js";
import type {
  EpisodeRecord,
  JobEventRecord,
  JobStatus,
  NotificationLogRecord,
  PlatformFormat,
  PlatformId,
  PlatformJobRecord,
  PublishBundle,
  TransportType,
} from "../types.js";

const ALLOWED_TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  PLANNED: ["VALIDATED", "FAILED"],
  VALIDATED: ["UPLOADING", "FAILED"],
  UPLOADING: ["SCHEDULED", "PENDING_HUMAN_CLICK", "PUBLISHED", "FAILED"],
  SCHEDULED: ["PUBLISHED", "FAILED"],
  PENDING_HUMAN_CLICK: ["PUBLISHED", "FAILED"],
  PUBLISHED: [],
  FAILED: ["PLANNED", "VALIDATED"],
};

export interface JobPatch {
  transport?: TransportType;
  scheduledAt?: string | null;
  publishedUrl?: string | null;
  externalId?: string | null;
  stagingPath?: string | null;
  studioUrl?: string | null;
  lastError?: string | null;
}

function asString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new Error(`Expected string for column '${field}', got ${typeof value}`);
  }
  return value;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown, field: string): number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  throw new Error(`Expected number for column '${field}', got ${typeof value}`);
}

function asNullableNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  return null;
}

function mapEpisodeRow(row: Record<string, unknown>): EpisodeRecord {
  return {
    episodeId: asString(row.episode_id, "episode_id"),
    title: asString(row.title, "title"),
    pillar: asString(row.pillar, "pillar"),
    sourceType: asString(row.source_type, "source_type") as PublishBundle["sourceType"],
    sourcePath: asNullableString(row.source_path),
    canonicalUrl: asNullableString(row.canonical_url),
    bundleJson: asString(row.bundle_json, "bundle_json"),
    createdAt: asString(row.created_at, "created_at"),
    updatedAt: asString(row.updated_at, "updated_at"),
  };
}

function mapJobRow(row: Record<string, unknown>): PlatformJobRecord {
  return {
    id: asNumber(row.id, "id"),
    episodeId: asString(row.episode_id, "episode_id"),
    platform: asString(row.platform, "platform") as PlatformId,
    format: asString(row.format, "format") as PlatformFormat,
    transport: asString(row.transport, "transport") as TransportType,
    status: asString(row.status, "status") as JobStatus,
    contentHash: asString(row.content_hash, "content_hash"),
    scheduledAt: asNullableString(row.scheduled_at),
    publishedUrl: asNullableString(row.published_url),
    externalId: asNullableString(row.external_id),
    stagingPath: asNullableString(row.staging_path),
    studioUrl: asNullableString(row.studio_url),
    lastError: asNullableString(row.last_error),
    payloadJson: asString(row.payload_json, "payload_json"),
    createdAt: asString(row.created_at, "created_at"),
    updatedAt: asString(row.updated_at, "updated_at"),
  };
}

function mapEventRow(row: Record<string, unknown>): JobEventRecord {
  return {
    id: asNumber(row.id, "id"),
    jobId: asNumber(row.job_id, "job_id"),
    episodeId: asString(row.episode_id, "episode_id"),
    platform: asString(row.platform, "platform") as PlatformId,
    fromStatus: asNullableString(row.from_status) as JobStatus | null,
    toStatus: asString(row.to_status, "to_status") as JobStatus,
    message: asString(row.message, "message"),
    createdAt: asString(row.created_at, "created_at"),
  };
}

function mapNotificationRow(row: Record<string, unknown>): NotificationLogRecord {
  return {
    id: asNumber(row.id, "id"),
    episodeId: asString(row.episode_id, "episode_id"),
    channel: asString(row.channel, "channel") as NotificationLogRecord["channel"],
    status: asString(row.status, "status") as NotificationLogRecord["status"],
    summary: asString(row.summary, "summary"),
    responseCode: asNullableNumber(row.response_code),
    error: asNullableString(row.error),
    createdAt: asString(row.created_at, "created_at"),
  };
}

/**
 * SQLite persistence layer backed by Node 22's built-in `node:sqlite` DatabaseSync.
 */
export class TablighDatabase {
  private readonly db: DatabaseSync;
  public readonly dbPath: string;

  constructor(dbPath: string = ":memory:") {
    this.dbPath = dbPath;
    if (dbPath !== ":memory:") {
      fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
    }

    this.db = new DatabaseSync(dbPath, { enableForeignKeyConstraints: true });
    if (dbPath !== ":memory:") {
      this.db.exec("PRAGMA journal_mode = WAL;");
    }
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS episodes (
        episode_id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        pillar TEXT NOT NULL,
        source_type TEXT NOT NULL,
        source_path TEXT,
        canonical_url TEXT,
        bundle_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS platform_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        episode_id TEXT NOT NULL REFERENCES episodes(episode_id) ON DELETE CASCADE,
        platform TEXT NOT NULL,
        format TEXT NOT NULL,
        transport TEXT NOT NULL,
        status TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        scheduled_at TEXT,
        published_url TEXT,
        external_id TEXT,
        staging_path TEXT,
        studio_url TEXT,
        last_error TEXT,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(episode_id, platform, format)
      );

      CREATE INDEX IF NOT EXISTS idx_jobs_platform_hash
        ON platform_jobs(platform, content_hash);

      CREATE INDEX IF NOT EXISTS idx_jobs_status
        ON platform_jobs(status);

      CREATE TABLE IF NOT EXISTS job_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id INTEGER NOT NULL REFERENCES platform_jobs(id) ON DELETE CASCADE,
        episode_id TEXT NOT NULL,
        platform TEXT NOT NULL,
        from_status TEXT,
        to_status TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS notification_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        episode_id TEXT NOT NULL,
        channel TEXT NOT NULL,
        status TEXT NOT NULL,
        summary TEXT NOT NULL,
        response_code INTEGER,
        error TEXT,
        created_at TEXT NOT NULL
      );
    `);
  }

  upsertEpisodeAndJobs(
    bundle: PublishBundle,
    options: { initialStatus?: JobStatus } = {},
  ): { episode: EpisodeRecord; jobs: PlatformJobRecord[] } {
    const now = new Date().toISOString();
    const initialStatus = options.initialStatus ?? "PLANNED";

    this.db
      .prepare(
        `INSERT INTO episodes (
          episode_id, title, pillar, source_type, source_path, canonical_url, bundle_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(episode_id) DO UPDATE SET
          title = excluded.title,
          pillar = excluded.pillar,
          source_type = excluded.source_type,
          source_path = excluded.source_path,
          canonical_url = excluded.canonical_url,
          bundle_json = excluded.bundle_json,
          updated_at = excluded.updated_at`,
      )
      .run(
        bundle.episodeId,
        bundle.title,
        bundle.pillar || "Tabligh",
        bundle.sourceType,
        bundle.sourcePath ?? null,
        bundle.canonicalUrl ?? null,
        JSON.stringify(bundle),
        now,
        now,
      );

    const selectJob = this.db.prepare(
      "SELECT * FROM platform_jobs WHERE episode_id = ? AND platform = ? AND format = ?",
    );
    const insertJob = this.db.prepare(
      `INSERT INTO platform_jobs (
        episode_id, platform, format, transport, status, content_hash,
        scheduled_at, payload_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const updateJob = this.db.prepare(
      `UPDATE platform_jobs
       SET transport = ?, content_hash = ?, scheduled_at = ?, payload_json = ?, updated_at = ?
       WHERE id = ?`,
    );
    const insertEvent = this.db.prepare(
      `INSERT INTO job_events (job_id, episode_id, platform, from_status, to_status, message, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );

    const jobs: PlatformJobRecord[] = [];
    for (const target of bundle.targets) {
      const transport = resolveEffectiveTransport(target);
      const contentHash = computeContentHash(bundle.episodeId, target);
      const payloadJson = JSON.stringify(target);
      const existingRaw = selectJob.get(bundle.episodeId, target.platform, target.format);

      if (!existingRaw) {
        const res = insertJob.run(
          bundle.episodeId,
          target.platform,
          target.format,
          transport,
          initialStatus,
          contentHash,
          target.scheduledAt ?? null,
          payloadJson,
          now,
          now,
        );
        const insertedId = Number(res.lastInsertRowid);
        insertEvent.run(
          insertedId,
          bundle.episodeId,
          target.platform,
          null,
          initialStatus,
          `Job created as ${initialStatus} (${transport})`,
          now,
        );
        const created = this.getJobById(insertedId);
        if (created) {
          jobs.push(created);
        }
      } else {
        const existing = mapJobRow(existingRaw);
        updateJob.run(
          transport,
          contentHash,
          target.scheduledAt ?? existing.scheduledAt,
          payloadJson,
          now,
          existing.id,
        );
        const refreshed = this.getJobById(existing.id);
        if (refreshed) {
          jobs.push(refreshed);
        }
      }
    }

    const episode = this.getEpisode(bundle.episodeId);
    if (!episode) {
      throw new Error(`Failed to persist episode ${bundle.episodeId}`);
    }
    return { episode, jobs };
  }

  getEpisode(episodeId: string): EpisodeRecord | undefined {
    const row = this.db
      .prepare("SELECT * FROM episodes WHERE episode_id = ?")
      .get(episodeId);
    return row ? mapEpisodeRow(row) : undefined;
  }

  listEpisodes(): EpisodeRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM episodes ORDER BY updated_at DESC, created_at DESC")
      .all();
    return rows.map(mapEpisodeRow);
  }

  getJobById(jobId: number): PlatformJobRecord | undefined {
    const row = this.db
      .prepare("SELECT * FROM platform_jobs WHERE id = ?")
      .get(jobId);
    return row ? mapJobRow(row) : undefined;
  }

  listJobs(filter: {
    episodeId?: string;
    platform?: PlatformId;
    status?: JobStatus;
  } = {}): PlatformJobRecord[] {
    const clauses: string[] = [];
    const params: SQLInputValue[] = [];

    if (filter.episodeId) {
      clauses.push("episode_id = ?");
      params.push(filter.episodeId);
    }
    if (filter.platform) {
      clauses.push("platform = ?");
      params.push(filter.platform);
    }
    if (filter.status) {
      clauses.push("status = ?");
      params.push(filter.status);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = this.db
      .prepare(`SELECT * FROM platform_jobs ${where} ORDER BY id ASC`)
      .all(...params);
    return rows.map(mapJobRow);
  }

  getPublishedHashes(excludeEpisodeId?: string): Set<string> {
    const rows = excludeEpisodeId
      ? this.db
          .prepare(
            "SELECT platform, content_hash FROM platform_jobs WHERE status IN ('PUBLISHED', 'SCHEDULED') AND episode_id != ?",
          )
          .all(excludeEpisodeId)
      : this.db
          .prepare(
            "SELECT platform, content_hash FROM platform_jobs WHERE status IN ('PUBLISHED', 'SCHEDULED')",
          )
          .all();

    const hashes = new Set<string>();
    for (const row of rows) {
      const platform = asString(row.platform, "platform");
      const hash = asString(row.content_hash, "content_hash");
      hashes.add(`${platform}:${hash}`);
    }
    return hashes;
  }

  findPublishedOrScheduledByHash(
    platform: PlatformId,
    contentHash: string,
    excludeJobId?: number,
  ): PlatformJobRecord | undefined {
    const row = excludeJobId !== undefined
      ? this.db
          .prepare(
            `SELECT * FROM platform_jobs
             WHERE platform = ? AND content_hash = ? AND status IN ('PUBLISHED', 'SCHEDULED') AND id != ?
             LIMIT 1`,
          )
          .get(platform, contentHash, excludeJobId)
      : this.db
          .prepare(
            `SELECT * FROM platform_jobs
             WHERE platform = ? AND content_hash = ? AND status IN ('PUBLISHED', 'SCHEDULED')
             LIMIT 1`,
          )
          .get(platform, contentHash);
    return row ? mapJobRow(row) : undefined;
  }

  transitionJobStatus(
    jobId: number,
    toStatus: JobStatus,
    patch: JobPatch = {},
    eventMessage?: string,
  ): PlatformJobRecord {
    const current = this.getJobById(jobId);
    if (!current) {
      throw new Error(`Platform job #${jobId} not found.`);
    }

    const allowed = ALLOWED_TRANSITIONS[current.status];
    if (current.status !== toStatus && !allowed.includes(toStatus)) {
      throw new Error(
        `Invalid state transition for ${current.episodeId}/${current.platform}: ${current.status} -> ${toStatus}`,
      );
    }

    const now = new Date().toISOString();
    const nextTransport = patch.transport ?? current.transport;
    const nextScheduledAt =
      patch.scheduledAt !== undefined ? patch.scheduledAt : current.scheduledAt;
    const nextPublishedUrl =
      patch.publishedUrl !== undefined ? patch.publishedUrl : current.publishedUrl;
    const nextExternalId =
      patch.externalId !== undefined ? patch.externalId : current.externalId;
    const nextStagingPath =
      patch.stagingPath !== undefined ? patch.stagingPath : current.stagingPath;
    const nextStudioUrl =
      patch.studioUrl !== undefined ? patch.studioUrl : current.studioUrl;
    const nextLastError =
      patch.lastError !== undefined ? patch.lastError : current.lastError;

    this.db
      .prepare(
        `UPDATE platform_jobs
         SET status = ?, transport = ?, scheduled_at = ?, published_url = ?,
             external_id = ?, staging_path = ?, studio_url = ?, last_error = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        toStatus,
        nextTransport,
        nextScheduledAt,
        nextPublishedUrl,
        nextExternalId,
        nextStagingPath,
        nextStudioUrl,
        nextLastError,
        now,
        jobId,
      );

    this.db
      .prepare(
        `INSERT INTO job_events (job_id, episode_id, platform, from_status, to_status, message, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        jobId,
        current.episodeId,
        current.platform,
        current.status,
        toStatus,
        eventMessage ?? `Transitioned ${current.status} -> ${toStatus}`,
        now,
      );

    const updated = this.getJobById(jobId);
    if (!updated) {
      throw new Error(`Failed to reload job #${jobId} after update.`);
    }
    return updated;
  }

  markJobByEpisodePlatform(
    episodeId: string,
    platform: PlatformId,
    toStatus: "PUBLISHED" | "FAILED",
    url?: string,
    note?: string,
    format?: PlatformFormat,
  ): PlatformJobRecord {
    const jobs = this.listJobs({ episodeId, platform }).filter((job) =>
      format ? job.format === format : true,
    );
    if (jobs.length === 0) {
      throw new Error(`No platform job found for ${episodeId} / ${platform}.`);
    }

    const targetJob =
      jobs.find((j) => j.status === "PENDING_HUMAN_CLICK") ??
      jobs.find((j) => j.status === "SCHEDULED") ??
      jobs[0]!;

    const msg =
      note ??
      (toStatus === "PUBLISHED"
        ? `Human operator marked PUBLISHED${url ? ` (${url})` : ""}`
        : `Operator marked FAILED${url ? ` (${url})` : ""}`);

    return this.transitionJobStatus(
      targetJob.id,
      toStatus,
      {
        publishedUrl: url ?? targetJob.publishedUrl,
        lastError: toStatus === "FAILED" ? (note ?? "Marked failed by operator") : null,
      },
      msg,
    );
  }

  listJobEvents(limit: number = 50): JobEventRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM job_events ORDER BY id DESC LIMIT ?")
      .all(limit);
    return rows.map(mapEventRow);
  }

  logNotification(
    entry: Omit<NotificationLogRecord, "id" | "createdAt">,
  ): NotificationLogRecord {
    const now = new Date().toISOString();
    const res = this.db
      .prepare(
        `INSERT INTO notification_logs (episode_id, channel, status, summary, response_code, error, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        entry.episodeId,
        entry.channel,
        entry.status,
        entry.summary,
        entry.responseCode,
        entry.error,
        now,
      );

    const row = this.db
      .prepare("SELECT * FROM notification_logs WHERE id = ?")
      .get(Number(res.lastInsertRowid));
    if (!row) {
      throw new Error("Failed to read inserted notification log.");
    }
    return mapNotificationRow(row);
  }

  listNotifications(limit: number = 30): NotificationLogRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM notification_logs ORDER BY id DESC LIMIT ?")
      .all(limit);
    return rows.map(mapNotificationRow);
  }

  getOverviewStats(): {
    episodesCount: number;
    totalJobs: number;
    byStatus: Record<JobStatus, number>;
  } {
    const epRow = this.db.prepare("SELECT COUNT(*) AS count FROM episodes").get();
    const episodesCount = epRow ? asNumber(epRow.count, "count") : 0;

    const byStatus: Record<JobStatus, number> = {
      PLANNED: 0,
      VALIDATED: 0,
      UPLOADING: 0,
      SCHEDULED: 0,
      PENDING_HUMAN_CLICK: 0,
      PUBLISHED: 0,
      FAILED: 0,
    };

    const statusRows = this.db
      .prepare("SELECT status, COUNT(*) AS count FROM platform_jobs GROUP BY status")
      .all();

    let totalJobs = 0;
    for (const row of statusRows) {
      const status = asString(row.status, "status") as JobStatus;
      const count = asNumber(row.count, "count");
      if (status in byStatus) {
        byStatus[status] = count;
      }
      totalJobs += count;
    }

    return { episodesCount, totalJobs, byStatus };
  }

  close(): void {
    if (this.db.isOpen) {
      this.db.close();
    }
  }
}
