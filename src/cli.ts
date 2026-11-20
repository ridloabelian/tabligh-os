#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { serve } from "@hono/node-server";
import { runDoctor } from "./core/doctor.js";
import { ingestSource } from "./core/ingest.js";
import { planBundle, runPipeline } from "./core/state-machine.js";
import { enrichBundleWithUtm } from "./core/utm.js";
import { validateBundle } from "./core/validator.js";
import { TablighDatabase } from "./db/database.js";
import { seedDemoData } from "./demo/seed.js";
import { createApp } from "./server/app.js";
import { ALL_PLATFORMS, type PlatformId, type PublishBundle } from "./types.js";

function loadDotEnvIfPresent(): void {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) {
    return;
  }
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

function parseFlags(argv: string[]): { positional: string[]; flags: Record<string, string | boolean> } {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const eqIdx = arg.indexOf("=");
    if (eqIdx !== -1) {
      flags[arg.slice(2, eqIdx)] = arg.slice(eqIdx + 1);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      flags[key] = next;
      i += 1;
    } else {
      flags[key] = true;
    }
  }

  return { positional, flags };
}

function printHelp(): void {
  console.log(`tabligh-os CLI v0.1.0 — Agentic Omnichannel Publishing & Physical Approval Gate

Usage:
  tabligh ingest <source.md | folder> [--out publish.json] [--episode-id <id>]
  tabligh validate <publish.json> [--no-file-check]
  tabligh plan <publish.json> [--db ./data/tabligh.db]
  tabligh run [publish.json] [--only yt,x] [--dry-run] [--db ./data/tabligh.db]
  tabligh mark <episode_id> <platform> <PUBLISHED|FAILED> [--url <url>] [--note <note>]
  tabligh doctor [--json]
  tabligh serve [--port 8791] [--demo] [--db ./data/tabligh.db]
`);
}

function getDbPath(flags: Record<string, string | boolean>, isDemo = false): string {
  if (typeof flags.db === "string") {
    return flags.db;
  }
  if (isDemo) {
    return ":memory:";
  }
  return process.env.TABLIGH_DB_PATH || "./data/tabligh.db";
}

function readBundleFile(filePath: string): { bundle: PublishBundle; baseDir: string } {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Bundle file not found: ${filePath}`);
  }
  const parsed = JSON.parse(fs.readFileSync(resolved, "utf8")) as PublishBundle;
  return { bundle: enrichBundleWithUtm(parsed), baseDir: path.dirname(resolved) };
}

export async function runCli(argv: string[]): Promise<number> {
  loadDotEnvIfPresent();
  const [command, ...rest] = argv;
  if (!command || command === "--help" || command === "-h" || command === "help") {
    printHelp();
    return 0;
  }

  const { positional, flags } = parseFlags(rest);

  switch (command) {
    case "ingest": {
      const source = positional[0];
      if (!source) {
        console.error("Usage: tabligh ingest <source.md | folder> [--out publish.json]");
        return 1;
      }
      const bundle = ingestSource(source, {
        episodeId: typeof flags["episode-id"] === "string" ? flags["episode-id"] : undefined,
      });
      const outPath =
        typeof flags.out === "string" ? path.resolve(flags.out) : path.resolve("publish.json");
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, JSON.stringify(bundle, null, 2) + "\n", "utf8");
      console.log(`Generated ${outPath} for episode '${bundle.episodeId}' (${bundle.targets.length} channels).`);
      return 0;
    }

    case "validate": {
      const filePath = positional[0] ?? "publish.json";
      const { bundle, baseDir } = readBundleFile(filePath);
      const db = new TablighDatabase(getDbPath(flags));
      try {
        const checkFiles = flags["no-file-check"] ? false : true;
        const report = validateBundle(bundle, {
          existingPublishedHashes: db.getPublishedHashes(bundle.episodeId),
          checkFilesOnDisk: checkFiles,
          baseDir,
        });
        console.log(JSON.stringify(report, null, 2));
        return report.valid ? 0 : 1;
      } finally {
        db.close();
      }
    }

    case "plan": {
      const filePath = positional[0] ?? "publish.json";
      const { bundle, baseDir } = readBundleFile(filePath);
      const db = new TablighDatabase(getDbPath(flags));
      try {
        const result = planBundle(db, bundle, {
          checkFilesOnDisk: flags["no-file-check"] ? false : true,
          baseDir,
        });
        if (!result.valid) {
          console.error(JSON.stringify(result.report, null, 2));
          return 1;
        }
        console.log(
          `Planned episode '${result.bundle.episodeId}' with ${result.jobs.length} validated jobs in ${db.dbPath}.`,
        );
        return 0;
      } finally {
        db.close();
      }
    }

    case "run": {
      const filePath = positional[0];
      const db = new TablighDatabase(getDbPath(flags));
      try {
        let episodeId = typeof flags["episode-id"] === "string" ? flags["episode-id"] : undefined;
        let baseDir: string | undefined;

        if (filePath) {
          const loaded = readBundleFile(filePath);
          baseDir = loaded.baseDir;
          const planned = planBundle(db, loaded.bundle, {
            checkFilesOnDisk: flags["no-file-check"] ? false : true,
            baseDir,
          });
          if (!planned.valid) {
            console.error(JSON.stringify(planned.report, null, 2));
            return 1;
          }
          episodeId = planned.bundle.episodeId;
        }

        const only =
          typeof flags.only === "string"
            ? flags.only
                .split(",")
                .map((s) => s.trim() as PlatformId)
                .filter((p) => ALL_PLATFORMS.includes(p))
            : undefined;

        const summary = await runPipeline(db, {
          episodeId,
          only,
          dryRun: Boolean(flags["dry-run"]),
          checkFilesOnDisk: flags["no-file-check"] ? false : false,
          baseDir,
        });
        console.log(JSON.stringify(summary, null, 2));
        return summary.results.some((r) => r.status === "FAILED") ? 1 : 0;
      } finally {
        db.close();
      }
    }

    case "mark": {
      const [episodeId, platformRaw, statusRaw] = positional;
      if (!episodeId || !platformRaw || !statusRaw) {
        console.error("Usage: tabligh mark <episode_id> <platform> <PUBLISHED|FAILED> [--url <url>]");
        return 1;
      }
      const platform = platformRaw as PlatformId;
      const status = statusRaw.toUpperCase() as "PUBLISHED" | "FAILED";
      if (!ALL_PLATFORMS.includes(platform) || (status !== "PUBLISHED" && status !== "FAILED")) {
        console.error("Invalid platform or status. Status must be PUBLISHED or FAILED.");
        return 1;
      }

      const db = new TablighDatabase(getDbPath(flags));
      try {
        const job = db.markJobByEpisodePlatform(
          episodeId,
          platform,
          status,
          typeof flags.url === "string" ? flags.url : undefined,
          typeof flags.note === "string" ? flags.note : undefined,
          typeof flags.format === "string" ? (flags.format as never) : undefined,
        );
        console.log(JSON.stringify(job, null, 2));
        return 0;
      } finally {
        db.close();
      }
    }

    case "doctor": {
      const db = new TablighDatabase(getDbPath(flags));
      try {
        const report = await runDoctor({ db });
        if (flags.json) {
          console.log(JSON.stringify(report, null, 2));
        } else {
          console.log(`tabligh-os doctor (${report.osPlatform}, Node ${report.nodeVersion})`);
          console.log(`Supervisor: ${report.serviceSupervisor}`);
          console.log(`Readiness: ${report.readyCount}/${report.totalCount} checks ready\n`);
          for (const check of report.checks) {
            const icon = check.status === "ready" || check.status === "reachable" ? "OK" : "--";
            console.log(`[${icon}] ${check.label}: ${check.detail}`);
          }
        }
        return 0;
      } finally {
        db.close();
      }
    }

    case "serve": {
      const demoMode = Boolean(flags.demo);
      const port = Number(
        typeof flags.port === "string" ? flags.port : (process.env.PORT ?? 8791),
      );
      const host =
        typeof flags.host === "string" ? flags.host : (process.env.TABLIGH_HOST ?? "127.0.0.1");
      const db = new TablighDatabase(getDbPath(flags, demoMode));
      if (demoMode) {
        seedDemoData(db);
      }

      const app = createApp({ db, demoMode, port });
      const server = serve({
        fetch: app.fetch,
        port,
        hostname: host,
      });

      console.log(
        `tabligh-os control plane listening on http://${host}:${port} (${demoMode ? "demo" : "live"} mode)`,
      );

      await new Promise<void>((resolve) => {
        const shutdown = () => {
          server.close(() => {
            db.close();
            resolve();
          });
          if ("closeAllConnections" in server && typeof server.closeAllConnections === "function") {
            server.closeAllConnections();
          }
        };
        process.once("SIGINT", shutdown);
        process.once("SIGTERM", shutdown);
      });
      return 0;
    }

    default:
      console.error(`Unknown command '${command}'.`);
      printHelp();
      return 1;
  }
}

const isEntrypoint =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1]!)).href;

if (isEntrypoint) {
  runCli(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    });
}
