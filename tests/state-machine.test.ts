import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { planBundle, runPipeline } from "../src/core/state-machine.js";
import { TablighDatabase } from "../src/db/database.js";
import type { PublishBundle } from "../src/types.js";

describe("state machine, Physical Approval Gate & idempotency", () => {
  it("routes official API to PUBLISHED/SCHEDULED, halts TikTok at PENDING_HUMAN_CLICK, and blocks duplicate uploads", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tabligh-sm-"));
    const db = new TablighDatabase(":memory:");

    try {
      const bundle: PublishBundle = {
        schemaVersion: "1.0",
        episodeId: "ep-gate-01",
        title: "Physical Approval Gate Test",
        pillar: "Tabligh",
        sourceType: "manual",
        targets: [
          {
            platform: "x",
            format: "tweet",
            body: "Thread pembuka tentang arsitektur publish aman: https://ridlo.id/posts/gate",
            ctaUrl: "https://ridlo.id/posts/gate",
          },
          {
            platform: "youtube",
            format: "shorts",
            title: "Shorts Scheduled",
            scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
            body: "Deskripsi shorts",
            media: [{ path: "short.mp4", type: "video", width: 1080, height: 1920, durationSec: 45 }],
          },
          {
            platform: "tiktok",
            format: "video",
            useTrendingAudio: true,
            body: "TikTok hook native https://ridlo.id/posts/gate",
            tags: ["aiagent"],
            media: [{ path: "short.mp4", type: "video", width: 1080, height: 1920, durationSec: 45 }],
          },
        ],
      };

      const planned = planBundle(db, bundle, { checkFilesOnDisk: false });
      expect(planned.valid).toBe(true);
      expect(planned.jobs.every((j) => j.status === "VALIDATED")).toBe(true);

      // Run 1 (dry-run simulated API + CDP staging)
      const run1 = await runPipeline(db, {
        episodeId: "ep-gate-01",
        dryRun: true,
        stagingDir: tmpDir,
        checkFilesOnDisk: false,
      });

      const byPlatform = new Map(run1.results.map((r) => [r.platform, r]));
      expect(byPlatform.get("x")?.status).toBe("PUBLISHED");
      expect(byPlatform.get("youtube")?.status).toBe("SCHEDULED");
      expect(byPlatform.get("tiktok")?.status).toBe("PENDING_HUMAN_CLICK");
      expect(fs.existsSync(byPlatform.get("tiktok")!.stagingPath!)).toBe(true);

      // Run 2 must skip PUBLISHED, SCHEDULED, and PENDING_HUMAN_CLICK idempotently
      const run2 = await runPipeline(db, {
        episodeId: "ep-gate-01",
        dryRun: true,
        stagingDir: tmpDir,
        checkFilesOnDisk: false,
      });
      const r2ByPlatform = new Map(run2.results.map((r) => [r.platform, r]));
      expect(r2ByPlatform.get("x")?.action).toBe("skipped_idempotent");
      expect(r2ByPlatform.get("youtube")?.action).toBe("skipped_idempotent");
      expect(r2ByPlatform.get("tiktok")?.action).toBe("skipped_pending_human");
      expect(r2ByPlatform.get("tiktok")?.status).toBe("PENDING_HUMAN_CLICK");

      // Re-planning identical content under a new episode ID must fail validation due to content_hash guard
      const duplicateBundle: PublishBundle = {
        ...bundle,
        episodeId: "ep-gate-02-dup",
        targets: [
          {
            platform: "x",
            format: "tweet",
            body: bundle.targets[0]!.body,
            ctaUrl: bundle.targets[0]!.ctaUrl,
          },
        ],
      };
      const dupPlan = planBundle(db, duplicateBundle, { checkFilesOnDisk: false });
      expect(dupPlan.valid).toBe(false);
      expect(dupPlan.report.errors.some((e) => e.code === "DUPLICATE_CONTENT_HASH")).toBe(true);

      // Illegal state downgrade must throw
      expect(() =>
        db.transitionJobStatus(
          db.listJobs({ episodeId: "ep-gate-01", platform: "x" })[0]!.id,
          "PLANNED",
        ),
      ).toThrow(/Invalid state transition/);

      // Human operator confirms TikTok publish
      const marked = db.markJobByEpisodePlatform(
        "ep-gate-01",
        "tiktok",
        "PUBLISHED",
        "https://www.tiktok.com/@ridloabelian/video/999",
      );
      expect(marked.status).toBe("PUBLISHED");
      expect(marked.publishedUrl).toBe("https://www.tiktok.com/@ridloabelian/video/999");
    } finally {
      db.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
