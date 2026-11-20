import type { TablighDatabase } from "../db/database.js";
import {
  PLATFORM_LABELS,
  type NotificationLogRecord,
  type PlatformJobRecord,
} from "../types.js";

export interface NotifyOptions {
  dashboardUrl?: string;
  env?: NodeJS.ProcessEnv;
  fetchFn?: typeof fetch;
}

export interface NotificationDispatchSummary {
  episodeId: string;
  textSummary: string;
  logs: NotificationLogRecord[];
}

const STATUS_BADGE: Record<string, string> = {
  PUBLISHED: "[PUBLISHED]",
  SCHEDULED: "[SCHEDULED]",
  PENDING_HUMAN_CLICK: "[SIAP KLIK PUBLISH]",
  VALIDATED: "[VALIDATED]",
  PLANNED: "[PLANNED]",
  UPLOADING: "[UPLOADING]",
  FAILED: "[FAILED]",
};

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Formats an executive status digest card suitable for both WhatsApp (waflare)
 * and Telegram Bot API HTML formatting.
 */
export function formatReleaseStatusCard(
  episodeTitle: string,
  episodeId: string,
  jobs: PlatformJobRecord[],
  dashboardUrl: string,
): { plainText: string; telegramHtml: string; pendingHumanCount: number } {
  const pendingHuman = jobs.filter((j) => j.status === "PENDING_HUMAN_CLICK");
  const lines = [
    `TABLIGH OS · ${episodeTitle}`,
    `Episode: ${episodeId}`,
    "",
  ];

  for (const job of jobs) {
    const label = PLATFORM_LABELS[job.platform];
    const badge = STATUS_BADGE[job.status] ?? `[${job.status}]`;
    const linkSuffix = job.publishedUrl ? ` -> ${job.publishedUrl}` : "";
    lines.push(`${badge} ${label} (${job.format})${linkSuffix}`);
  }

  if (pendingHuman.length > 0) {
    lines.push(
      "",
      `Physical Approval Gate (${pendingHuman.length}): buka ${dashboardUrl} untuk 1-Click Copy & Mark Published.`,
    );
  } else {
    lines.push("", `Control Plane: ${dashboardUrl}`);
  }

  const htmlLines = [
    `<b>TABLIGH OS</b> · ${escapeHtml(episodeTitle)}`,
    `<code>${escapeHtml(episodeId)}</code>`,
    "",
  ];
  for (const job of jobs) {
    const label = PLATFORM_LABELS[job.platform];
    const badge = STATUS_BADGE[job.status] ?? `[${job.status}]`;
    const linkSuffix = job.publishedUrl
      ? ` — <a href="${escapeHtml(job.publishedUrl)}">Link Tayang</a>`
      : "";
    htmlLines.push(`${escapeHtml(badge)} <b>${escapeHtml(label)}</b> (${escapeHtml(job.format)})${linkSuffix}`);
  }
  if (pendingHuman.length > 0) {
    htmlLines.push(
      "",
      `<b>Physical Approval Gate (${pendingHuman.length})</b>: siapkan klik Publish di ${escapeHtml(dashboardUrl)}`,
    );
  }

  return {
    plainText: lines.join("\n"),
    telegramHtml: htmlLines.join("\n"),
    pendingHumanCount: pendingHuman.length,
  };
}

/**
 * Sends release status cards to WhatsApp (`waflare` webhook compatible) and
 * Telegram Bot API (`sendMessage`), logging every attempt into SQLite.
 */
export async function sendReleaseNotifications(
  db: TablighDatabase,
  episodeId: string,
  options: NotifyOptions = {},
): Promise<NotificationDispatchSummary> {
  const env = options.env ?? process.env;
  const fetchFn = options.fetchFn ?? fetch;
  const dashboardUrl = options.dashboardUrl ?? env.TABLIGH_DASHBOARD_URL ?? "http://localhost:8791";

  const episode = db.getEpisode(episodeId);
  const jobs = db.listJobs({ episodeId });
  const card = formatReleaseStatusCard(
    episode?.title ?? episodeId,
    episodeId,
    jobs,
    dashboardUrl,
  );

  const logs: NotificationLogRecord[] = [];

  // 1. WhatsApp via waflare webhook
  const waflareUrl = env.WAFLARE_WEBHOOK_URL?.trim();
  if (!waflareUrl) {
    logs.push(
      db.logNotification({
        episodeId,
        channel: "waflare",
        status: "skipped",
        summary: card.plainText,
        responseCode: null,
        error: "WAFLARE_WEBHOOK_URL not configured",
      }),
    );
  } else {
    try {
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (env.WAFLARE_AUTH_TOKEN) {
        headers.authorization = `Bearer ${env.WAFLARE_AUTH_TOKEN}`;
      }
      const resp = await fetchFn(waflareUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          event: "tabligh.release_status",
          episodeId,
          to: env.WAFLARE_TARGET_JID ?? undefined,
          text: card.plainText,
          approvalQueueCount: card.pendingHumanCount,
          dashboardUrl,
          jobs: jobs.map((j) => ({
            platform: j.platform,
            format: j.format,
            status: j.status,
            publishedUrl: j.publishedUrl,
            stagingPath: j.stagingPath,
          })),
        }),
      });
      logs.push(
        db.logNotification({
          episodeId,
          channel: "waflare",
          status: resp.ok ? "sent" : "failed",
          summary: card.plainText,
          responseCode: resp.status,
          error: resp.ok ? null : `HTTP ${resp.status}`,
        }),
      );
    } catch (err) {
      logs.push(
        db.logNotification({
          episodeId,
          channel: "waflare",
          status: "failed",
          summary: card.plainText,
          responseCode: null,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  // 2. Telegram Bot API
  const tgToken = env.TELEGRAM_BOT_TOKEN?.trim();
  const tgChatId = env.TELEGRAM_CHAT_ID?.trim();
  if (!tgToken || !tgChatId) {
    logs.push(
      db.logNotification({
        episodeId,
        channel: "telegram",
        status: "skipped",
        summary: card.plainText,
        responseCode: null,
        error: "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured",
      }),
    );
  } else {
    try {
      const tgUrl = `https://api.telegram.org/bot${tgToken}/sendMessage`;
      const resp = await fetchFn(tgUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: tgChatId,
          text: card.telegramHtml,
          parse_mode: "HTML",
          disable_web_page_preview: true,
          reply_markup: {
            inline_keyboard: [
              [{ text: "Buka Tabligh Control Plane", url: dashboardUrl }],
            ],
          },
        }),
      });
      logs.push(
        db.logNotification({
          episodeId,
          channel: "telegram",
          status: resp.ok ? "sent" : "failed",
          summary: card.plainText,
          responseCode: resp.status,
          error: resp.ok ? null : `HTTP ${resp.status}`,
        }),
      );
    } catch (err) {
      logs.push(
        db.logNotification({
          episodeId,
          channel: "telegram",
          status: "failed",
          summary: card.plainText,
          responseCode: null,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  return {
    episodeId,
    textSummary: card.plainText,
    logs,
  };
}
