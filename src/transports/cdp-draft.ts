import fs from "node:fs";
import path from "node:path";
import { PLATFORM_STUDIO_URLS, type PlatformTarget } from "../types.js";

export interface CdpDraftInput {
  episodeId: string;
  target: PlatformTarget;
  stagingDir?: string;
  dryRun?: boolean;
  env?: NodeJS.ProcessEnv;
  fetchFn?: typeof fetch;
}

export interface CdpDraftResult {
  outcome: "PENDING_HUMAN_CLICK";
  stagingPath: string;
  studioUrl: string;
  cdpConnected: boolean;
  cdpMessage: string;
  message: string;
}

function buildCopyableCaption(target: PlatformTarget): string {
  const tagsLine =
    target.tags && target.tags.length > 0
      ? `\n\n${target.tags.map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" ")}`
      : "";
  const ctaLine =
    target.ctaUrl && !target.body.includes(target.ctaUrl)
      ? `\n\n${target.ctaUrl}`
      : "";
  return `${target.body.trim()}${ctaLine}${tagsLine}\n`;
}

/**
 * Stages a human-ready asset + caption packet for high-risk anti-bot platforms
 * (TikTok Web / Instagram w/ trending audio), optionally connects to an already-logged-in
 * Chrome CDP endpoint (`CHROME_CDP_URL`) without ever storing credentials, and
 * ALWAYS halts at `PENDING_HUMAN_CLICK` (Physical Approval Gate).
 */
export async function stageCdpDraft(input: CdpDraftInput): Promise<CdpDraftResult> {
  const { episodeId, target } = input;
  const env = input.env ?? process.env;
  const fetchFn = input.fetchFn ?? fetch;
  const baseStaging = input.stagingDir ?? env.TABLIGH_STAGING_DIR ?? "./data/staging";
  const episodeStagingDir = path.resolve(baseStaging, episodeId, `${target.platform}-${target.format}`);

  fs.mkdirSync(episodeStagingDir, { recursive: true });

  const captionPath = path.join(episodeStagingDir, "caption.txt");
  const packetPath = path.join(episodeStagingDir, "draft-packet.json");
  const studioUrl = PLATFORM_STUDIO_URLS[target.platform];

  fs.writeFileSync(captionPath, buildCopyableCaption(target), "utf8");
  fs.writeFileSync(
    packetPath,
    JSON.stringify(
      {
        episodeId,
        platform: target.platform,
        format: target.format,
        studioUrl,
        useTrendingAudio: Boolean(target.useTrendingAudio),
        scheduledAt: target.scheduledAt ?? null,
        ctaUrl: target.ctaUrl ?? null,
        tags: target.tags ?? [],
        media: target.media ?? [],
        humanApprovalGate: true,
        stagedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    "utf8",
  );

  let cdpConnected = false;
  let cdpMessage = "CDP endpoint not configured; staged in Human Approval Queue.";

  const cdpBase = env.CHROME_CDP_URL?.trim().replace(/\/+$/, "");
  if (cdpBase && !input.dryRun) {
    try {
      const versionResp = await fetchFn(`${cdpBase}/json/version`, {
        signal: AbortSignal.timeout(1500),
      });
      if (versionResp.ok) {
        cdpConnected = true;
        // Open upload studio tab inside user's existing authenticated browser profile
        await fetchFn(`${cdpBase}/json/new?${encodeURIComponent(studioUrl)}`, {
          method: "PUT",
          signal: AbortSignal.timeout(1500),
        }).catch(() => undefined);
        cdpMessage = `Connected to local Chrome CDP (${cdpBase}) and opened studio upload tab.`;
      } else {
        cdpMessage = `Chrome CDP probe returned HTTP ${versionResp.status}; staged locally for manual click.`;
      }
    } catch {
      cdpMessage = `Chrome CDP (${cdpBase}) unreachable; staged locally in Human Approval Queue.`;
    }
  } else if (cdpBase && input.dryRun) {
    cdpMessage = `[dry-run] Skipped live CDP probe (${cdpBase}); staged packet for Human Approval Queue.`;
  }

  return {
    outcome: "PENDING_HUMAN_CLICK",
    stagingPath: packetPath,
    studioUrl,
    cdpConnected,
    cdpMessage,
    message: `Staged draft packet at ${packetPath}. ${cdpMessage} Waiting for human Publish click.`,
  };
}
