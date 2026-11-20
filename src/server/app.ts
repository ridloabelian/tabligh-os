import { Hono } from "hono";
import { runDoctor } from "../core/doctor.js";
import { planBundle, runPipeline } from "../core/state-machine.js";
import { validateBundle } from "../core/validator.js";
import type { TablighDatabase } from "../db/database.js";
import {
  ALL_PLATFORMS,
  PLATFORM_LABELS,
  type PlatformId,
  type PublishBundle,
} from "../types.js";
import { renderDashboardHtml } from "./dashboard.js";

export interface AppConfig {
  db: TablighDatabase;
  demoMode?: boolean;
  port?: number;
  stagingDir?: string;
  env?: NodeJS.ProcessEnv;
  fetchFn?: typeof fetch;
}

/**
 * Creates the Hono HTTP Control Plane and REST API application.
 */
export function createApp(config: AppConfig): Hono {
  const app = new Hono();
  const port = config.port ?? 8791;
  const demoMode = config.demoMode ?? false;
  const env = config.env ?? process.env;
  const fetchFn = config.fetchFn ?? fetch;

  app.get("/", (c) => {
    return c.html(renderDashboardHtml({ demoMode, port }));
  });

  app.get("/api/health", (c) => {
    const stats = config.db.getOverviewStats();
    return c.json({
      ok: true,
      service: "tabligh-os",
      port,
      demoMode,
      stats,
    });
  });

  app.get("/api/overview", (c) => {
    const stats = config.db.getOverviewStats();
    const episodes = config.db.listEpisodes();
    const jobs = config.db.listJobs();
    const approvalQueue = jobs.filter((j) => j.status === "PENDING_HUMAN_CLICK");
    const events = config.db.listJobEvents(40);
    const notifications = config.db.listNotifications(20);
    const platforms = ALL_PLATFORMS.map((id) => ({
      id,
      label: PLATFORM_LABELS[id],
    }));

    return c.json({
      demoMode,
      port,
      stats,
      episodes,
      jobs,
      approvalQueue,
      events,
      notifications,
      platforms,
    });
  });

  app.get("/api/episodes", (c) => {
    return c.json({ episodes: config.db.listEpisodes() });
  });

  app.get("/api/episodes/:id", (c) => {
    const episodeId = c.req.param("id");
    const episode = config.db.getEpisode(episodeId);
    if (!episode) {
      return c.json({ error: `Episode '${episodeId}' not found.` }, 404);
    }
    const jobs = config.db.listJobs({ episodeId });
    return c.json({ episode, jobs });
  });

  app.post("/api/validate", async (c) => {
    let body: { bundle?: PublishBundle; checkFilesOnDisk?: boolean } | PublishBundle;
    try {
      body = (await c.req.json()) as { bundle?: PublishBundle; checkFilesOnDisk?: boolean } | PublishBundle;
    } catch {
      return c.json({ error: "Invalid JSON body." }, 400);
    }

    const bundle = "bundle" in body && body.bundle ? body.bundle : (body as PublishBundle);
    const checkFilesOnDisk = "checkFilesOnDisk" in body ? Boolean(body.checkFilesOnDisk) : false;

    const report = validateBundle(bundle, {
      existingPublishedHashes: config.db.getPublishedHashes(bundle.episodeId),
      checkFilesOnDisk,
    });

    return c.json({ report });
  });

  app.post("/api/plan", async (c) => {
    let body: { bundle?: PublishBundle; checkFilesOnDisk?: boolean } | PublishBundle;
    try {
      body = (await c.req.json()) as { bundle?: PublishBundle; checkFilesOnDisk?: boolean } | PublishBundle;
    } catch {
      return c.json({ error: "Invalid JSON body." }, 400);
    }

    const bundle = "bundle" in body && body.bundle ? body.bundle : (body as PublishBundle);
    const checkFilesOnDisk = "checkFilesOnDisk" in body ? Boolean(body.checkFilesOnDisk) : false;

    const result = planBundle(config.db, bundle, { checkFilesOnDisk });
    if (!result.valid) {
      return c.json(result, 422);
    }
    return c.json(result);
  });

  app.post("/api/run", async (c) => {
    let body: {
      episodeId?: string;
      only?: PlatformId[];
      dryRun?: boolean;
    } = {};
    try {
      const text = await c.req.text();
      if (text.trim()) {
        body = JSON.parse(text) as typeof body;
      }
    } catch {
      return c.json({ error: "Invalid JSON payload." }, 400);
    }

    const summary = await runPipeline(config.db, {
      episodeId: body.episodeId,
      only: body.only,
      dryRun: body.dryRun ?? demoMode,
      demoMode,
      stagingDir: config.stagingDir,
      checkFilesOnDisk: false,
      env,
      fetchFn,
      notify: !demoMode && !(body.dryRun ?? false),
    });

    return c.json({ summary });
  });

  app.post("/api/episodes/:episodeId/platforms/:platform/mark", async (c) => {
    const episodeId = c.req.param("episodeId");
    const platform = c.req.param("platform") as PlatformId;

    if (!ALL_PLATFORMS.includes(platform)) {
      return c.json({ error: `Unsupported platform '${platform}'.` }, 400);
    }

    let body: { status?: "PUBLISHED" | "FAILED"; url?: string; note?: string; format?: string };
    try {
      body = (await c.req.json()) as typeof body;
    } catch {
      return c.json({ error: "Invalid JSON payload." }, 400);
    }

    if (body.status !== "PUBLISHED" && body.status !== "FAILED") {
      return c.json({ error: "status must be 'PUBLISHED' or 'FAILED'." }, 400);
    }

    try {
      const job = config.db.markJobByEpisodePlatform(
        episodeId,
        platform,
        body.status,
        body.url,
        body.note,
        body.format as never,
      );
      return c.json({ job });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 404);
    }
  });

  app.get("/api/doctor", async (c) => {
    const report = await runDoctor({
      db: config.db,
      env,
      fetchFn,
    });
    return c.json(report);
  });

  return app;
}
