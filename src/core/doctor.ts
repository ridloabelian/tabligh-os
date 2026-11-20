import os from "node:os";
import type { TablighDatabase } from "../db/database.js";
import type { PlatformId } from "../types.js";

export interface DoctorCheckItem {
  id: string;
  label: string;
  category: "runtime" | "official_api" | "notification" | "cdp";
  status: "ready" | "missing" | "reachable" | "unreachable";
  detail: string;
  envVars?: string[];
}

export interface DoctorReport {
  checkedAt: string;
  osPlatform: string;
  nodeVersion: string;
  serviceSupervisor: string;
  dbPath: string;
  readyCount: number;
  totalCount: number;
  checks: DoctorCheckItem[];
}

const API_CREDENTIAL_SPEC: Array<{
  platform: PlatformId;
  label: string;
  envVars: string[];
}> = [
  { platform: "youtube", label: "YouTube Data API v3", envVars: ["YOUTUBE_ACCESS_TOKEN"] },
  { platform: "x", label: "X API v2", envVars: ["X_BEARER_TOKEN"] },
  { platform: "linkedin", label: "LinkedIn Posts API", envVars: ["LINKEDIN_ACCESS_TOKEN"] },
  {
    platform: "instagram",
    label: "Meta Graph API (Instagram)",
    envVars: ["META_GRAPH_TOKEN", "INSTAGRAM_IG_USER_ID"],
  },
  {
    platform: "threads",
    label: "Meta Graph API (Threads)",
    envVars: ["META_GRAPH_TOKEN", "THREADS_USER_ID"],
  },
  {
    platform: "whatsapp_channel",
    label: "WhatsApp Channel (waflare)",
    envVars: ["WAFLARE_CHANNEL_WEBHOOK_URL"],
  },
  { platform: "emdash", label: "EmDash CMS (ridlo.id)", envVars: ["EMDASH_URL", "EMDASH_TOKEN"] },
];

/**
 * Inspects Node runtime, SQLite persistence, Official API token configuration,
 * WhatsApp (`waflare`) & Telegram webhook settings, and optional Chrome CDP readiness.
 */
export async function runDoctor(options: {
  db?: TablighDatabase;
  env?: NodeJS.ProcessEnv;
  fetchFn?: typeof fetch;
} = {}): Promise<DoctorReport> {
  const env = options.env ?? process.env;
  const fetchFn = options.fetchFn ?? fetch;
  const checks: DoctorCheckItem[] = [];

  const nodeMajor = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
  checks.push({
    id: "runtime.node",
    label: "Node.js Runtime (>= 22)",
    category: "runtime",
    status: nodeMajor >= 22 ? "ready" : "missing",
    detail: `v${process.versions.node}`,
  });

  if (options.db) {
    const stats = options.db.getOverviewStats();
    checks.push({
      id: "runtime.sqlite",
      label: "SQLite State Store (node:sqlite)",
      category: "runtime",
      status: "ready",
      detail: `${options.db.dbPath} (${stats.episodesCount} episodes, ${stats.totalJobs} jobs)`,
    });
  }

  for (const spec of API_CREDENTIAL_SPEC) {
    const present = spec.envVars.filter((k) => Boolean(env[k]?.trim()));
    const allPresent = present.length === spec.envVars.length;
    checks.push({
      id: `api.${spec.platform}`,
      label: spec.label,
      category: "official_api",
      status: allPresent ? "ready" : "missing",
      detail: allPresent
        ? `Configured (${present.join(", ")})`
        : `Missing ${spec.envVars.filter((k) => !env[k]?.trim()).join(", ")}`,
      envVars: spec.envVars,
    });
  }

  const waflareReady = Boolean(env.WAFLARE_WEBHOOK_URL?.trim());
  checks.push({
    id: "notify.waflare",
    label: "WhatsApp Webhook (waflare)",
    category: "notification",
    status: waflareReady ? "ready" : "missing",
    detail: waflareReady
      ? `Configured (${env.WAFLARE_WEBHOOK_URL})`
      : "Missing WAFLARE_WEBHOOK_URL",
    envVars: ["WAFLARE_WEBHOOK_URL"],
  });

  const tgReady = Boolean(env.TELEGRAM_BOT_TOKEN?.trim() && env.TELEGRAM_CHAT_ID?.trim());
  checks.push({
    id: "notify.telegram",
    label: "Telegram Bot API",
    category: "notification",
    status: tgReady ? "ready" : "missing",
    detail: tgReady
      ? `Configured for chat ${env.TELEGRAM_CHAT_ID}`
      : "Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID",
    envVars: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"],
  });

  const cdpBase = env.CHROME_CDP_URL?.trim().replace(/\/+$/, "") || "http://127.0.0.1:9222";
  let cdpStatus: DoctorCheckItem["status"] = "unreachable";
  let cdpDetail = `CDP endpoint ${cdpBase} unreachable (Human Approval Queue fallback active)`;
  try {
    const resp = await fetchFn(`${cdpBase}/json/version`, {
      signal: AbortSignal.timeout(1000),
    });
    if (resp.ok) {
      const json = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
      const browserName = typeof json.Browser === "string" ? json.Browser : "Chromium";
      cdpStatus = "reachable";
      cdpDetail = `Reachable at ${cdpBase} (${browserName})`;
    }
  } catch {
    // Expected when Chrome is not launched with --remote-debugging-port
  }

  checks.push({
    id: "cdp.chrome",
    label: "Chrome CDP Draft-Filler (Optional)",
    category: "cdp",
    status: cdpStatus,
    detail: cdpDetail,
    envVars: ["CHROME_CDP_URL"],
  });

  const platform = os.platform();
  const serviceSupervisor =
    platform === "linux"
      ? "systemd --user (deploy/systemd)"
      : platform === "darwin"
        ? "launchd (deploy/launchd)"
        : platform;

  const readyCount = checks.filter(
    (c) => c.status === "ready" || c.status === "reachable",
  ).length;

  return {
    checkedAt: new Date().toISOString(),
    osPlatform: `${platform} (${os.arch()})`,
    nodeVersion: `v${process.versions.node}`,
    serviceSupervisor,
    dbPath: options.db?.dbPath ?? ":none:",
    readyCount,
    totalCount: checks.length,
    checks,
  };
}
