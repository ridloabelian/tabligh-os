import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  getExpectedAspectRatios,
  matchesExpectedAspectRatio,
  resolveMediaDimensions,
} from "./media-inspector.js";
import { inspectMp4Faststart } from "./mp4-faststart.js";
import type {
  PlatformTarget,
  PublishBundle,
  TargetValidationResult,
  TransportType,
  ValidationIssue,
  ValidationReport,
} from "../types.js";

const DEFAULT_FORBIDDEN_WORDS = [
  "100% pasti untung",
  "jaminan profit tanpa risiko",
  "uang gratis tanpa syarat",
];

const PLACEHOLDER_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  { name: "TODO/TBD/FIXME marker", regex: /\b(TODO|TBD|FIXME)\b/ },
  { name: "Mustache template variable", regex: /\{\{[^}]+\}\}/ },
  { name: "Bracketed placeholder", regex: /\[(INSERT|ISI|PLACEHOLDER|LINK)[^\]]*\]/i },
  { name: "Lorem ipsum filler", regex: /lorem ipsum/i },
];

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface ValidateBundleOptions {
  existingPublishedHashes?: Set<string>;
  checkFilesOnDisk?: boolean;
  baseDir?: string;
}

/**
 * Resolves the effective transport for a target, enforcing the Physical Approval Gate
 * on high-risk anti-bot platforms (TikTok and Instagram Reels with trending audio).
 */
export function resolveEffectiveTransport(target: PlatformTarget): TransportType {
  if (target.transport) {
    return target.transport;
  }
  if (target.platform === "tiktok") {
    return "cdp_draft";
  }
  if (target.platform === "instagram" && target.useTrendingAudio === true) {
    return "cdp_draft";
  }
  return "official_api";
}

function stripTrackingQuery(text: string): string {
  return text.replace(/([?&])(utm_campaign|ef_ep)=[^&\s#)]*/g, "$1").replace(/[?&]+$/g, "");
}

/**
 * Computes a deterministic SHA-256 content hash for anti-duplicate idempotency.
 */
export function computeContentHash(_episodeId: string, target: PlatformTarget): string {
  const canonicalPayload = {
    platform: target.platform,
    format: target.format,
    title: (target.title ?? "").trim(),
    body: stripTrackingQuery(target.body.trim()),
    threadItems: (target.threadItems ?? []).map((item) => stripTrackingQuery(item.trim())),
    ctaUrl: stripTrackingQuery((target.ctaUrl ?? "").trim()),
    mediaPaths: (target.media ?? []).map((m) => m.path),
  };

  return crypto
    .createHash("sha256")
    .update(JSON.stringify(canonicalPayload))
    .digest("hex");
}

function resolveAssetPath(assetPath: string, baseDir?: string): string {
  if (path.isAbsolute(assetPath)) {
    return assetPath;
  }
  if (baseDir) {
    const fromBase = path.resolve(baseDir, assetPath);
    if (fs.existsSync(fromBase)) {
      return fromBase;
    }
  }
  const fromCwd = path.resolve(process.cwd(), assetPath);
  if (fs.existsSync(fromCwd)) {
    return fromCwd;
  }
  return path.resolve(baseDir ?? process.cwd(), assetPath);
}

function scanTextQuality(
  target: PlatformTarget,
  forbiddenWords: string[],
  issues: ValidationIssue[],
): void {
  const texts: Array<{ field: string; value: string }> = [];
  if (target.title) {
    texts.push({ field: "title", value: target.title });
  }
  texts.push({ field: "body", value: target.body });
  for (const [idx, item] of (target.threadItems ?? []).entries()) {
    texts.push({ field: `threadItems[${idx}]`, value: item });
  }

  for (const { field, value } of texts) {
    for (const pattern of PLACEHOLDER_PATTERNS) {
      if (pattern.regex.test(value)) {
        issues.push({
          code: "UNFILLED_PLACEHOLDER",
          severity: "error",
          platform: target.platform,
          format: target.format,
          field,
          message: `Detected unfilled placeholder (${pattern.name}) in ${target.platform}.${field}.`,
        });
      }
    }

    const lowered = value.toLowerCase();
    for (const phrase of forbiddenWords) {
      const normalized = phrase.trim().toLowerCase();
      if (normalized && lowered.includes(normalized)) {
        issues.push({
          code: "FORBIDDEN_WORD",
          severity: "error",
          platform: target.platform,
          format: target.format,
          field,
          message: `Forbidden phrase "${phrase}" found in ${target.platform}.${field}.`,
        });
      }
    }
  }
}

function validatePlatformConstraints(target: PlatformTarget, issues: ValidationIssue[]): void {
  const { platform, format } = target;
  const media = target.media ?? [];

  switch (platform) {
    case "x": {
      if (format === "tweet") {
        if (!target.body.trim()) {
          issues.push({
            code: "EMPTY_BODY",
            severity: "error",
            platform,
            format,
            field: "body",
            message: "X tweet body cannot be empty.",
          });
        } else if (target.body.length > 280) {
          issues.push({
            code: "CHAR_LIMIT_EXCEEDED",
            severity: "error",
            platform,
            format,
            field: "body",
            message: `X tweet exceeds 280 characters (${target.body.length}/280).`,
          });
        }
      } else if (format === "thread") {
        const items = target.threadItems ?? [];
        if (items.length < 2) {
          issues.push({
            code: "THREAD_TOO_SHORT",
            severity: "error",
            platform,
            format,
            field: "threadItems",
            message: "X thread requires at least 2 items in threadItems.",
          });
        }
        items.forEach((item, idx) => {
          if (!item.trim()) {
            issues.push({
              code: "EMPTY_BODY",
              severity: "error",
              platform,
              format,
              field: `threadItems[${idx}]`,
              message: `X thread item #${idx + 1} cannot be empty.`,
            });
          } else if (item.length > 280) {
            issues.push({
              code: "CHAR_LIMIT_EXCEEDED",
              severity: "error",
              platform,
              format,
              field: `threadItems[${idx}]`,
              message: `X thread item #${idx + 1} exceeds 280 characters (${item.length}/280).`,
            });
          }
        });
      } else if (format === "article") {
        if (!target.title?.trim() || target.title.length > 150) {
          issues.push({
            code: "TITLE_CONSTRAINT",
            severity: "error",
            platform,
            format,
            field: "title",
            message: "X article requires a title of 1..150 characters.",
          });
        }
        if (target.body.length > 25000) {
          issues.push({
            code: "CHAR_LIMIT_EXCEEDED",
            severity: "error",
            platform,
            format,
            field: "body",
            message: `X article exceeds 25,000 characters (${target.body.length}/25000).`,
          });
        }
      }
      break;
    }

    case "linkedin": {
      if (!target.body.trim()) {
        issues.push({
          code: "EMPTY_BODY",
          severity: "error",
          platform,
          format,
          field: "body",
          message: "LinkedIn body cannot be empty.",
        });
      } else if (target.body.length > 3000) {
        issues.push({
          code: "CHAR_LIMIT_EXCEEDED",
          severity: "error",
          platform,
          format,
          field: "body",
          message: `LinkedIn post exceeds 3000 characters (${target.body.length}/3000).`,
        });
      }
      break;
    }

    case "tiktok": {
      if (target.body.length > 2200) {
        issues.push({
          code: "CHAR_LIMIT_EXCEEDED",
          severity: "error",
          platform,
          format,
          field: "body",
          message: `TikTok caption exceeds 2200 characters (${target.body.length}/2200).`,
        });
      }
      if (media.length < 1) {
        issues.push({
          code: "MEDIA_REQUIRED",
          severity: "error",
          platform,
          format,
          field: "media",
          message: "TikTok target requires at least 1 media asset.",
        });
      }
      break;
    }

    case "instagram": {
      if (target.body.length > 2200) {
        issues.push({
          code: "CHAR_LIMIT_EXCEEDED",
          severity: "error",
          platform,
          format,
          field: "body",
          message: `Instagram caption exceeds 2200 characters (${target.body.length}/2200).`,
        });
      }
      if ((target.tags?.length ?? 0) > 30) {
        issues.push({
          code: "TOO_MANY_HASHTAGS",
          severity: "error",
          platform,
          format,
          field: "tags",
          message: `Instagram allows at most 30 hashtags (${target.tags?.length}/30).`,
        });
      }
      if (format === "reels") {
        const video = media.find((m) => m.type === "video");
        if (!video) {
          issues.push({
            code: "MEDIA_REQUIRED",
            severity: "error",
            platform,
            format,
            field: "media",
            message: "Instagram Reels requires 1 vertical (9:16) video asset.",
          });
        }
      } else if (format === "carousel") {
        const images = media.filter((m) => m.type === "image");
        if (images.length < 2 || images.length > 10) {
          issues.push({
            code: "MEDIA_COUNT_INVALID",
            severity: "error",
            platform,
            format,
            field: "media",
            message: `Instagram Carousel requires 2..10 images (got ${images.length}).`,
          });
        }
      } else if (media.length < 1) {
        issues.push({
          code: "MEDIA_REQUIRED",
          severity: "error",
          platform,
          format,
          field: "media",
          message: "Instagram target requires at least 1 media asset.",
        });
      }
      break;
    }

    case "youtube": {
      const title = target.title?.trim() ?? "";
      if (!title) {
        issues.push({
          code: "TITLE_REQUIRED",
          severity: "error",
          platform,
          format,
          field: "title",
          message: "YouTube target requires a title.",
        });
      } else if (title.length > 100) {
        issues.push({
          code: "CHAR_LIMIT_EXCEEDED",
          severity: "error",
          platform,
          format,
          field: "title",
          message: `YouTube title exceeds 100 characters (${title.length}/100).`,
        });
      }
      if (target.body.length > 5000) {
        issues.push({
          code: "CHAR_LIMIT_EXCEEDED",
          severity: "error",
          platform,
          format,
          field: "body",
          message: `YouTube description exceeds 5000 characters (${target.body.length}/5000).`,
        });
      }
      const video = media.find((m) => m.type === "video");
      if (!video) {
        issues.push({
          code: "MEDIA_REQUIRED",
          severity: "error",
          platform,
          format,
          field: "media",
          message: "YouTube target requires a video asset.",
        });
      } else if (format === "shorts" && video.durationSec !== undefined && video.durationSec > 180) {
        issues.push({
          code: "DURATION_LIMIT_EXCEEDED",
          severity: "error",
          platform,
          format,
          field: "media",
          message: `YouTube Shorts duration exceeds 180s (${video.durationSec}s).`,
        });
      }
      break;
    }

    case "threads": {
      if (format === "thread") {
        const items = target.threadItems ?? [];
        if (items.length < 2) {
          issues.push({
            code: "THREAD_TOO_SHORT",
            severity: "error",
            platform,
            format,
            field: "threadItems",
            message: "Threads thread format requires at least 2 items in threadItems.",
          });
        }
        items.forEach((item, idx) => {
          if (item.length > 500) {
            issues.push({
              code: "CHAR_LIMIT_EXCEEDED",
              severity: "error",
              platform,
              format,
              field: `threadItems[${idx}]`,
              message: `Threads item #${idx + 1} exceeds 500 characters (${item.length}/500).`,
            });
          }
        });
      } else {
        if (!target.body.trim()) {
          issues.push({
            code: "EMPTY_BODY",
            severity: "error",
            platform,
            format,
            field: "body",
            message: "Threads post body cannot be empty.",
          });
        } else if (target.body.length > 500) {
          issues.push({
            code: "CHAR_LIMIT_EXCEEDED",
            severity: "error",
            platform,
            format,
            field: "body",
            message: `Threads post exceeds 500 characters (${target.body.length}/500).`,
          });
        }
      }
      break;
    }

    case "whatsapp_channel": {
      if (!target.body.trim()) {
        issues.push({
          code: "EMPTY_BODY",
          severity: "error",
          platform,
          format,
          field: "body",
          message: "WhatsApp Channel broadcast body cannot be empty.",
        });
      } else if (target.body.length > 4096) {
        issues.push({
          code: "CHAR_LIMIT_EXCEEDED",
          severity: "error",
          platform,
          format,
          field: "body",
          message: `WhatsApp Channel broadcast exceeds 4096 characters (${target.body.length}/4096).`,
        });
      }
      break;
    }

    case "emdash": {
      const title = target.title?.trim() ?? "";
      if (!title || title.length > 160) {
        issues.push({
          code: "TITLE_CONSTRAINT",
          severity: "error",
          platform,
          format,
          field: "title",
          message: "EmDash CMS entry requires a title of 1..160 characters.",
        });
      }
      if (!target.slug || !SLUG_RE.test(target.slug)) {
        issues.push({
          code: "INVALID_SLUG",
          severity: "error",
          platform,
          format,
          field: "slug",
          message: `EmDash CMS slug "${target.slug ?? ""}" must be valid kebab-case.`,
        });
      }
      if (target.body.trim().length < 50) {
        issues.push({
          code: "BODY_TOO_SHORT",
          severity: "error",
          platform,
          format,
          field: "body",
          message: `EmDash CMS body requires at least 50 characters (got ${target.body.trim().length}).`,
        });
      }
      break;
    }
  }
}

function validateMediaAssets(
  target: PlatformTarget,
  checkFilesOnDisk: boolean,
  baseDir: string | undefined,
  issues: ValidationIssue[],
): void {
  const expectedAspects = getExpectedAspectRatios(target.platform, target.format);

  for (const [idx, asset] of (target.media ?? []).entries()) {
    const resolvedPath = resolveAssetPath(asset.path, baseDir);
    const existsOnDisk = fs.existsSync(resolvedPath);

    if (checkFilesOnDisk && !existsOnDisk) {
      issues.push({
        code: "MEDIA_FILE_MISSING",
        severity: "error",
        platform: target.platform,
        format: target.format,
        field: `media[${idx}].path`,
        message: `Media file not found on disk: ${asset.path}`,
      });
    }

    if (asset.type === "video" && existsOnDisk && asset.path.toLowerCase().endsWith(".mp4")) {
      const mp4 = inspectMp4Faststart(resolvedPath);
      if (!mp4.validMp4) {
        issues.push({
          code: "INVALID_MP4_CONTAINER",
          severity: "error",
          platform: target.platform,
          format: target.format,
          field: `media[${idx}].path`,
          message: mp4.error ?? `Invalid MP4 file: ${asset.path}`,
        });
      } else if (!mp4.isFastStart) {
        issues.push({
          code: "MP4_NOT_FASTSTART",
          severity: "error",
          platform: target.platform,
          format: target.format,
          field: `media[${idx}].path`,
          message: mp4.error ?? `MP4 moov atom is after mdat in ${asset.path}.`,
          remediation: mp4.remediation,
        });
      }
    }

    if (expectedAspects) {
      const dims = resolveMediaDimensions(asset, resolvedPath);
      if (dims.width && dims.height) {
        const { matches, actualRatio } = matchesExpectedAspectRatio(
          dims.width,
          dims.height,
          expectedAspects,
        );
        if (!matches) {
          issues.push({
            code: "ASPECT_RATIO_MISMATCH",
            severity: "error",
            platform: target.platform,
            format: target.format,
            field: `media[${idx}]`,
            message: `Media aspect ratio ${dims.width}x${dims.height} (${actualRatio.toFixed(3)}) does not match expected ${expectedAspects.join(" or ")} for ${target.platform}:${target.format}.`,
          });
        }
      }
    }
  }
}

/**
 * Deterministically validates a PublishBundle across platform character limits,
 * media aspect ratios, MP4 faststart (`moov` before `mdat`), placeholders, forbidden
 * words, and SHA-256 content-hash idempotency.
 */
export function validateBundle(
  bundle: PublishBundle,
  options: ValidateBundleOptions = {},
): ValidationReport {
  const checkFilesOnDisk = options.checkFilesOnDisk ?? true;
  const existingHashes = options.existingPublishedHashes ?? new Set<string>();
  const forbiddenWords = [...DEFAULT_FORBIDDEN_WORDS, ...(bundle.forbiddenWords ?? [])];

  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const targetResults: TargetValidationResult[] = [];

  if (!bundle.episodeId || !SLUG_RE.test(bundle.episodeId)) {
    errors.push({
      code: "INVALID_EPISODE_ID",
      severity: "error",
      field: "episodeId",
      message: `episodeId "${bundle.episodeId}" must be valid kebab-case (e.g. ep-2026-wakaf-produktif).`,
    });
  }

  if (!bundle.title?.trim()) {
    errors.push({
      code: "MISSING_EPISODE_TITLE",
      severity: "error",
      field: "title",
      message: "Bundle title cannot be empty.",
    });
  }

  if (!bundle.targets || bundle.targets.length === 0) {
    errors.push({
      code: "NO_TARGETS",
      severity: "error",
      field: "targets",
      message: "PublishBundle must include at least one platform target.",
    });
  }

  const seenPlatformFormats = new Set<string>();

  for (const target of bundle.targets ?? []) {
    const key = `${target.platform}:${target.format}`;
    const targetIssues: ValidationIssue[] = [];

    if (seenPlatformFormats.has(key)) {
      targetIssues.push({
        code: "DUPLICATE_TARGET_KEY",
        severity: "error",
        platform: target.platform,
        format: target.format,
        message: `Duplicate target entry for ${key} within bundle.`,
      });
    }
    seenPlatformFormats.add(key);

    const effectiveTransport = resolveEffectiveTransport(target);
    const contentHash = computeContentHash(bundle.episodeId, target);

    if (existingHashes.has(`${target.platform}:${contentHash}`) || existingHashes.has(contentHash)) {
      targetIssues.push({
        code: "DUPLICATE_CONTENT_HASH",
        severity: "error",
        platform: target.platform,
        format: target.format,
        message: `Idempotency guard: identical content hash (${contentHash.slice(0, 12)}) already published/scheduled on ${target.platform}.`,
      });
    }

    scanTextQuality(target, forbiddenWords, targetIssues);
    validatePlatformConstraints(target, targetIssues);
    validateMediaAssets(target, checkFilesOnDisk, options.baseDir, targetIssues);

    for (const issue of targetIssues) {
      if (issue.severity === "error") {
        errors.push(issue);
      } else {
        warnings.push(issue);
      }
    }

    targetResults.push({
      platform: target.platform,
      format: target.format,
      effectiveTransport,
      contentHash,
      valid: targetIssues.every((i) => i.severity !== "error"),
      issues: targetIssues,
    });
  }

  return {
    valid: errors.length === 0,
    episodeId: bundle.episodeId,
    checkedAt: new Date().toISOString(),
    errors,
    warnings,
    targets: targetResults,
  };
}
