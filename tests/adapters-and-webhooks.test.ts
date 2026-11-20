import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TablighDatabase } from "../src/db/database.js";
import { sendReleaseNotifications } from "../src/notifications/notifier.js";
import { stageCdpDraft } from "../src/transports/cdp-draft.js";
import { publishViaOfficialApi } from "../src/transports/official-api.js";

describe("Official API adapter, CDP Draft-Filler & waflare/Telegram webhooks", () => {
  it("dispatches X thread & EmDash CMS via Official API using mock fetch", async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    const mockFetch: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
      calls.push({ url, body });

      return new Response(JSON.stringify({ data: { id: `tweet-${calls.length}` }, id: "em-1" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const xRes = await publishViaOfficialApi({
      episodeId: "ep-api",
      target: {
        platform: "x",
        format: "thread",
        body: "Fallback",
        threadItems: ["Tweet 1", "Tweet 2"],
      },
      env: { X_BEARER_TOKEN: "x-test-token" },
      fetchFn: mockFetch,
    });

    expect(xRes.ok).toBe(true);
    expect(xRes.outcome).toBe("PUBLISHED");
    expect(calls).toHaveLength(2);
    expect(calls[1]?.body.reply).toEqual({ in_reply_to_tweet_id: "tweet-1" });

    const emRes = await publishViaOfficialApi({
      episodeId: "ep-api",
      target: {
        platform: "emdash",
        format: "posts",
        title: "Test Post",
        slug: "test-post",
        collection: "posts",
        body: "Long enough content body for EmDash CMS validation check.",
      },
      env: { EMDASH_URL: "https://ridlo.id", EMDASH_TOKEN: "em-token" },
      fetchFn: mockFetch,
    });
    expect(emRes.ok).toBe(true);
    expect(emRes.publishedUrl).toBe("https://ridlo.id/posts/test-post");
  });

  it("stages CDP draft packet & attaches to reachable Chrome CDP without auto-clicking publish", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tabligh-cdp-"));
    const cdpCalls: string[] = [];
    const mockFetch: typeof fetch = async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      cdpCalls.push(url);
      return new Response(JSON.stringify({ Browser: "Chrome/132.0" }), { status: 200 });
    };

    try {
      const res = await stageCdpDraft({
        episodeId: "ep-cdp",
        target: {
          platform: "tiktok",
          format: "video",
          body: "Native TikTok caption",
          tags: ["tablighos", "#ai"],
          ctaUrl: "https://ridlo.id/posts/cdp?ef_ep=ep-cdp",
        },
        stagingDir: tmpDir,
        env: { CHROME_CDP_URL: "http://127.0.0.1:9222" },
        fetchFn: mockFetch,
      });

      expect(res.outcome).toBe("PENDING_HUMAN_CLICK");
      expect(res.cdpConnected).toBe(true);
      expect(cdpCalls.some((u) => u.endsWith("/json/version"))).toBe(true);
      expect(cdpCalls.some((u) => u.includes("/json/new?"))).toBe(true);
      expect(fs.existsSync(res.stagingPath)).toBe(true);
      expect(
        fs.readFileSync(path.join(path.dirname(res.stagingPath), "caption.txt"), "utf8"),
      ).toContain("#tablighos #ai");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("sends structured release status cards to waflare & Telegram Bot API", async () => {
    const db = new TablighDatabase(":memory:");
    const sentRequests: Array<{ url: string; payload: Record<string, unknown> }> = [];
    const mockFetch: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      const payload = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      sentRequests.push({ url, payload });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };

    try {
      db.upsertEpisodeAndJobs({
        schemaVersion: "1.0",
        episodeId: "ep-notify",
        title: "Notif Test Episode",
        pillar: "Tabligh",
        sourceType: "manual",
        targets: [
          { platform: "x", format: "tweet", body: "Hello X" },
          { platform: "tiktok", format: "video", body: "Hello TikTok", media: [{ path: "a.mp4", type: "video" }] },
        ],
      });

      const summary = await sendReleaseNotifications(db, "ep-notify", {
        dashboardUrl: "http://localhost:8791",
        env: {
          WAFLARE_WEBHOOK_URL: "https://waflare.example.test/webhook",
          WAFLARE_TARGET_JID: "628123456789@s.whatsapp.net",
          TELEGRAM_BOT_TOKEN: "123:ABC",
          TELEGRAM_CHAT_ID: "-100999",
        },
        fetchFn: mockFetch,
      });

      expect(summary.logs).toHaveLength(2);
      expect(summary.logs.every((l) => l.status === "sent")).toBe(true);
      expect(sentRequests[0]?.url).toBe("https://waflare.example.test/webhook");
      expect(sentRequests[0]?.payload.event).toBe("tabligh.release_status");
      expect(sentRequests[1]?.url).toBe("https://api.telegram.org/bot123:ABC/sendMessage");
      expect(sentRequests[1]?.payload.chat_id).toBe("-100999");
    } finally {
      db.close();
    }
  });
});
