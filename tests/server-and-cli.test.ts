import path from "node:path";
import { describe, expect, it } from "vitest";
import { ingestSource } from "../src/core/ingest.js";
import { validateBundle } from "../src/core/validator.js";
import { TablighDatabase } from "../src/db/database.js";
import { seedDemoData } from "../src/demo/seed.js";
import { createApp } from "../src/server/app.js";

describe("ingest & HTTP Control Plane API", () => {
  it("ingests Markdown frontmatter into 8 native targets with edge-funnel UTMs", () => {
    const mdPath = path.resolve("examples/wakaf-produktif.md");
    const bundle = ingestSource(mdPath);

    expect(bundle.episodeId).toBe("ep-wakaf-produktif-cashflow-riil");
    expect(bundle.targets).toHaveLength(8);
    for (const target of bundle.targets) {
      expect(target.ctaUrl).toContain(`utm_source=${target.platform}`);
      expect(target.ctaUrl).toContain(`ef_ep=${bundle.episodeId}`);
    }

    const report = validateBundle(bundle, { checkFilesOnDisk: false });
    expect(report.valid).toBe(true);
  });

  it("ingests 9:16 video manifest pack and passes disk faststart MP4 validation", () => {
    const packDir = path.resolve("examples/agentic-short-pack");
    const bundle = ingestSource(packDir);

    expect(bundle.sourceType).toBe("video_manifest");
    expect(bundle.targets.some((t) => t.platform === "tiktok" && t.transport === "cdp_draft")).toBe(true);

    const report = validateBundle(bundle, { checkFilesOnDisk: true });
    expect(report.valid).toBe(true);
  });

  it("serves editorial dark-first dashboard and interactive API routes", async () => {
    const db = new TablighDatabase(":memory:");
    seedDemoData(db);
    const app = createApp({ db, demoMode: true, port: 8791 });

    try {
      const htmlRes = await app.request("/");
      expect(htmlRes.status).toBe(200);
      const html = await htmlRes.text();
      expect(html).toContain("#08101F");
      expect(html).toContain("Siap Klik Publish");
      expect(html).toContain("Plus Jakarta Sans");

      const healthRes = await app.request("/api/health");
      expect(healthRes.status).toBe(200);
      const health = (await healthRes.json()) as { ok: boolean; port: number; demoMode: boolean };
      expect(health.ok).toBe(true);
      expect(health.port).toBe(8791);
      expect(health.demoMode).toBe(true);

      const ovRes = await app.request("/api/overview");
      expect(ovRes.status).toBe(200);
      const ov = (await ovRes.json()) as {
        approvalQueue: Array<{ episodeId: string; platform: string }>;
        platforms: Array<{ id: string }>;
      };
      expect(ov.platforms).toHaveLength(8);
      expect(ov.approvalQueue.length).toBeGreaterThanOrEqual(3);

      // Mark one approval item as PUBLISHED via HTTP API
      const markRes = await app.request(
        "/api/episodes/ep-2026-wakaf-produktif/platforms/tiktok/mark",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            status: "PUBLISHED",
            url: "https://www.tiktok.com/@ridloabelian/video/7777",
          }),
        },
      );
      expect(markRes.status).toBe(200);
      const markJson = (await markRes.json()) as { job: { status: string; publishedUrl: string } };
      expect(markJson.job.status).toBe("PUBLISHED");
      expect(markJson.job.publishedUrl).toBe("https://www.tiktok.com/@ridloabelian/video/7777");

      // Doctor endpoint
      const docRes = await app.request("/api/doctor");
      expect(docRes.status).toBe(200);
      const docJson = (await docRes.json()) as { checks: unknown[] };
      expect(docJson.checks.length).toBeGreaterThan(5);
    } finally {
      db.close();
    }
  });
});
