# AGENTS.md — Developer & Agent Guidelines for `tabligh-os`

## Overview
`tabligh-os` is a TypeScript (Node.js >= 22, ESM) omnichannel publishing and human-governed content distribution OS using Hono (`@hono/node-server`) and built-in `node:sqlite`.

## Critical Invariants
1. **Physical Approval Gate**: Never auto-transition `PENDING_HUMAN_CLICK` to `PUBLISHED` inside automated pipeline code (`src/core/state-machine.ts` or `src/transports/cdp-draft.ts`). Only explicit human confirmation (`tabligh mark` CLI or `POST /api/episodes/:episodeId/platforms/:platform/mark`) may complete that transition.
2. **Idempotency Guard**: Never upload/dispatch a target if `job.status` is `PUBLISHED`/`SCHEDULED`, or if `(platform, content_hash)` already exists in `PUBLISHED`/`SCHEDULED` state inside `platform_jobs`.
3. **Deterministic Validation Before Execution**: Character limits, media aspect ratios, ISO BMFF MP4 `moov < mdat` faststart checks, unfilled placeholder checks, and forbidden word scans in `src/core/validator.ts` must run cleanly before persisting or uploading.
4. **Default Port**: Always default HTTP server and Control Plane references to `:8791` (`http://localhost:8791`).
5. **`edge-funnel` UTM Injection**: Preserve idempotency in `src/core/utm.ts` — calling `enrichBundleWithUtm` multiple times must never duplicate `utm_*` or `ef_ep` parameters.

## Commands
- `npm run typecheck` — strict TypeScript check (`tsc --noEmit`)
- `npm run build` — compile `src/` into `dist/`
- `npm test` — run full Vitest suite (`tests/`)
- `npm run demo` — launch in-memory demo Control Plane on `http://127.0.0.1:8791`
