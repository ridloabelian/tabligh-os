---
name: tabligh-repurpose
description: >-
  Use this skill when transforming 1 long-form essay, Zettelkasten note, or
  9:16 video manifest into a native 8-channel `publish.json` release bundle,
  validating constraints/MP4 faststart, and orchestrating tabligh-os publishing
  with Physical Approval Gate governance.
---

# Tabligh Repurpose & Omnichannel Release Workflow

`tabligh-os` operationalizes **Pilar 4 Tabligh (*Bi qadri 'uqulihim*)**: deliver the exact same core truth adapted natively to each platform's cognition, format, and constraints—never lazy cross-posted spam.

## 1. Core Invariants (Must Never Be Violated)

1. **Native Per-Channel Hook**: Never reuse the exact same opening sentence across X, LinkedIn, TikTok, Instagram, Threads, YouTube, WhatsApp Channel, and EmDash. Tailor hook density, tone, and call-to-action to each audience.
2. **Physical Approval Gate**: High-risk anti-bot channels (`tiktok` and `instagram` when `useTrendingAudio: true`) MUST use `transport: "cdp_draft"` and halt at `PENDING_HUMAN_CLICK`. Never attempt browser auto-click Publish.
3. **`edge-funnel` Attribution**: Every outbound link in `ctaUrl`, `body`, and `threadItems` MUST carry `?utm_source=<platform>&utm_medium=social&utm_campaign=<episode_id>&ef_ep=<episode_id>`.
4. **Deterministic Pre-Flight Validation**: Never run `plan` or `run` before `tabligh validate` exits `0` (character limits, aspect ratios, MP4 `moov` atom faststart, unfilled placeholders, forbidden words, and SHA-256 anti-double-upload guard).

## 2. Channel Playbook (8 Supported Channels)

| Channel | Format(s) | Hard Limit | Media & Aspect | Transport |
| :--- | :--- | :--- | :--- | :--- |
| `emdash` | `posts`, `notes` | Title `<= 160`, kebab-case `slug`, Body `>= 50` | Optional cover | `official_api` |
| `x` | `tweet`, `thread`, `article` | Tweet/Item `<= 280` (`thread >= 2` items), Article `<= 25,000` | Optional | `official_api` |
| `linkedin` | `post`, `article` | Body `<= 3000` | Optional | `official_api` |
| `youtube` | `long`, `shorts` | Title `<= 100`, Desc `<= 5000` | `long`: `16:9`; `shorts`: `9:16` `<= 180s` (faststart MP4) | `official_api` |
| `instagram` | `reels`, `carousel` | Caption `<= 2200`, Hashtags `<= 30` | `reels`: `9:16` MP4; `carousel`: 2–10 images (`1:1` or `4:5`) | `official_api` (or `cdp_draft` w/ trending audio) |
| `tiktok` | `video`, `photo_carousel` | Caption `<= 2200` | `video`: `9:16` faststart MP4 | **`cdp_draft` (Human Gate)** |
| `threads` | `post`, `thread` | Post/Item `<= 500` | Optional | `official_api` |
| `whatsapp_channel` | `broadcast` | Body `<= 4096` | Optional | `official_api` (`waflare`) |

## 3. Step-by-Step Agent Workflow

### Step 1: Ingest Source Content into `publish.json`
From a Markdown essay (`ridlo.id` frontmatter) or `agentic-content-studio` video folder:
```bash
npx tabligh ingest examples/wakaf-produktif.md --out publish.json
# or from a 9:16 video manifest folder:
npx tabligh ingest examples/agentic-short-pack --out publish.json
```

### Step 2: Refine Native Channel Copy
Open `publish.json` and rewrite each target's hook and structure thoughtfully:
- **X (`thread`)**: Contrarian or empirical opening thesis in item 1 (`<= 280` chars), crisp numbered insights, link + `ef_ep` on the final tweet.
- **LinkedIn (`post`)**: Executive framing + scannable 3-point breakdown + analytical closing question (`<= 3000` chars).
- **YouTube (`long` / `shorts`)**: Searchable title `<= 100` chars, structured timestamps/context in description, faststart `.mp4`.
- **TikTok (`video`) & IG (`reels`)**: Pattern-interrupt first line, concise punchy caption, `useTrendingAudio: true` so `tabligh-os` routes to `PENDING_HUMAN_CLICK`.
- **WhatsApp Channel (`broadcast`)**: Scannable bold header (`*Title*`), 2–3 takeaway bullets, direct tracked link.
- **EmDash (`posts` / `notes`)**: Full canonical Markdown essay with `excerpt`, `tldr`, and kebab-case `slug`.

Ensure NO `TODO`, `TBD`, `FIXME`, `{{var}}`, `[INSERT ...]`, or scam/clickbait claims remain.

### Step 3: Validate Deterministically
```bash
npx tabligh validate publish.json
```
If validation reports `MP4_NOT_FASTSTART`, re-mux the video cleanly before proceeding:
```bash
ffmpeg -i input.mp4 -c copy -movflags +faststart output-faststart.mp4
```

### Step 4: Plan, Dry-Run, and Dispatch
```bash
npx tabligh plan publish.json
npx tabligh run publish.json --dry-run
# When ready for live release:
npx tabligh run publish.json
```

### Step 5: Complete Human Approval Gate
Check `http://localhost:8791` (or WhatsApp/Telegram status notifications) for any `PENDING_HUMAN_CLICK` channels (`tiktok`, trending-audio `instagram`). Upload/confirm manually inside your browser session, then mark published:
```bash
npx tabligh mark <episode_id> tiktok PUBLISHED --url "https://www.tiktok.com/@handle/video/123456"
```
