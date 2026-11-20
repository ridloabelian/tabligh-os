import fs from "node:fs";
import path from "node:path";
import type { MediaAsset, PlatformTarget, PublishBundle } from "../types.js";
import { enrichBundleWithUtm } from "./utm.js";

export interface ParsedFrontmatter {
  attributes: Record<string, string | string[]>;
  body: string;
}

export interface VideoManifestInput {
  episodeId?: string;
  title: string;
  pillar?: string;
  hook?: string;
  transcript?: string;
  summary?: string;
  canonicalUrl?: string;
  tags?: string[];
  videoPath: string;
  coverImagePath?: string;
  width?: number;
  height?: number;
  durationSec?: number;
  useTrendingAudio?: boolean;
}

export interface IngestOptions {
  episodeId?: string;
  canonicalBaseUrl?: string;
}

function slugify(input: string): string {
  const cleaned = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "ep-untitled";
}

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Parses YAML frontmatter compatible with `ridlo.id` EmDash Markdown essays/notes.
 */
export function parseMarkdownFrontmatter(raw: string): ParsedFrontmatter {
  const normalized = raw.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) {
    return { attributes: {}, body: normalized.trim() };
  }

  const endIdx = normalized.indexOf("\n---\n", 4);
  if (endIdx === -1) {
    return { attributes: {}, body: normalized.trim() };
  }

  const yamlBlock = normalized.slice(4, endIdx);
  const body = normalized.slice(endIdx + 5).trim();
  const attributes: Record<string, string | string[]> = {};

  let currentListKey: string | null = null;
  for (const line of yamlBlock.split("\n")) {
    const listMatch = line.match(/^\s*-\s+(.+)$/);
    if (listMatch && currentListKey) {
      const prev = attributes[currentListKey];
      const item = stripQuotes(listMatch[1] ?? "");
      if (Array.isArray(prev)) {
        prev.push(item);
      } else {
        attributes[currentListKey] = [item];
      }
      continue;
    }

    const kvMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kvMatch) {
      currentListKey = null;
      continue;
    }

    const key = kvMatch[1]!;
    const rawVal = (kvMatch[2] ?? "").trim();

    if (!rawVal) {
      attributes[key] = [];
      currentListKey = key;
      continue;
    }

    currentListKey = null;
    if (rawVal.startsWith("[") && rawVal.endsWith("]")) {
      const items = rawVal
        .slice(1, -1)
        .split(",")
        .map((part) => stripQuotes(part))
        .filter(Boolean);
      attributes[key] = items;
    } else {
      attributes[key] = stripQuotes(rawVal);
    }
  }

  return { attributes, body };
}

function extractKeyPoints(markdownBody: string): {
  headings: string[];
  paragraphs: string[];
  firstSentence: string;
} {
  const headings: string[] = [];
  const paragraphs: string[] = [];

  for (const block of markdownBody.split(/\n{2,}/)) {
    const trimmed = block.trim();
    if (!trimmed) {
      continue;
    }
    if (trimmed.startsWith("#")) {
      headings.push(trimmed.replace(/^#+\s*/, "").trim());
    } else {
      paragraphs.push(trimmed.replace(/\s+/g, " "));
    }
  }

  const firstPara = paragraphs[0] ?? markdownBody.trim();
  const sentenceMatch = firstPara.match(/^[^.!?]+[.!?]/);
  const firstSentence = (sentenceMatch?.[0] ?? firstPara).slice(0, 200).trim();

  return { headings, paragraphs, firstSentence };
}

function truncateForLimit(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, maxChars - 3).trimEnd()}...`;
}

function ingestMarkdown(filePath: string, options: IngestOptions): PublishBundle {
  const raw = fs.readFileSync(filePath, "utf8");
  const { attributes, body } = parseMarkdownFrontmatter(raw);
  const { headings, paragraphs, firstSentence } = extractKeyPoints(body);

  const rawTitle =
    (typeof attributes.title === "string" && attributes.title) ||
    headings[0] ||
    path.basename(filePath, path.extname(filePath));
  const slug =
    (typeof attributes.slug === "string" && slugify(attributes.slug)) ||
    slugify(rawTitle);
  const episodeId = options.episodeId ? slugify(options.episodeId) : `ep-${slug}`;
  const baseUrl = (options.canonicalBaseUrl ?? "https://ridlo.id").replace(/\/+$/, "");
  const collection = attributes.note_id ? "notes" : "posts";
  const canonicalUrl =
    (typeof attributes.canonical_url === "string" && attributes.canonical_url) ||
    `${baseUrl}/${collection}/${slug}`;

  const tldr =
    (typeof attributes.tldr === "string" && attributes.tldr) || firstSentence;
  const excerpt =
    (typeof attributes.excerpt === "string" && attributes.excerpt) || firstSentence;
  const tags = Array.isArray(attributes.tags)
    ? attributes.tags
    : typeof attributes.tags === "string"
      ? attributes.tags.split(",").map((t) => t.trim()).filter(Boolean)
      : ["tabligh-os", "builder-notes"];

  const featuredImage =
    typeof attributes.featured_image === "string" && attributes.featured_image
      ? attributes.featured_image
      : undefined;

  const baseMediaVideo: MediaAsset = {
    path: `assets/${episodeId}/vertical-9x16.mp4`,
    type: "video",
    width: 1080,
    height: 1920,
    durationSec: 58,
  };
  const baseMediaLongVideo: MediaAsset = {
    path: `assets/${episodeId}/landscape-16x9.mp4`,
    type: "video",
    width: 1920,
    height: 1080,
    durationSec: 420,
  };
  const carouselImages: MediaAsset[] = featuredImage
    ? [
        { path: featuredImage, type: "image", width: 1080, height: 1350 },
        { path: featuredImage, type: "image", width: 1080, height: 1350 },
      ]
    : [
        { path: `assets/${episodeId}/slide-1.png`, type: "image", width: 1080, height: 1350 },
        { path: `assets/${episodeId}/slide-2.png`, type: "image", width: 1080, height: 1350 },
      ];

  const coreBullets =
    headings.slice(0, 3).map((h, i) => `${i + 1}. ${h}`).join("\n") ||
    paragraphs.slice(0, 3).map((p, i) => `${i + 1}. ${truncateForLimit(p, 160)}`).join("\n");

  const targets: PlatformTarget[] = [
    {
      platform: "emdash",
      format: collection,
      transport: "official_api",
      title: rawTitle,
      slug,
      collection,
      excerpt,
      tldr,
      body,
      tags,
      ctaUrl: canonicalUrl,
    },
    {
      platform: "x",
      format: "thread",
      transport: "official_api",
      body: truncateForLimit(`${rawTitle} — ${tldr}`, 280),
      threadItems: [
        truncateForLimit(`Kebanyakan tim salah kaprah soal "${rawTitle}".\n\nIni inti tesisnya (thread):`, 260),
        truncateForLimit(`1/ ${paragraphs[0] ?? tldr}`, 260),
        truncateForLimit(`2/ ${paragraphs[1] ?? coreBullets}`, 260),
        truncateForLimit(`Baca analisis lengkap & cetak biru sistemnya di sini: ${canonicalUrl}`, 260),
      ],
      tags: tags.slice(0, 4),
      ctaUrl: canonicalUrl,
    },
    {
      platform: "linkedin",
      format: "post",
      transport: "official_api",
      body: truncateForLimit(
        `${rawTitle}\n\n${tldr}\n\nPoin arsitektur utama:\n${coreBullets}\n\nEsai lengkap tersedia di: ${canonicalUrl}`,
        2950,
      ),
      tags: tags.slice(0, 5),
      ctaUrl: canonicalUrl,
    },
    {
      platform: "threads",
      format: "post",
      transport: "official_api",
      body: truncateForLimit(
        `Catatan lapangan hari ini soal ${rawTitle}:\n\n${tldr}\n\nDetail lengkap: ${canonicalUrl}`,
        480,
      ),
      ctaUrl: canonicalUrl,
    },
    {
      platform: "whatsapp_channel",
      format: "broadcast",
      transport: "official_api",
      body: truncateForLimit(
        `*${rawTitle}*\n\n${tldr}\n\nRingkasan poin:\n${coreBullets}\n\nBaca selengkapnya: ${canonicalUrl}`,
        4000,
      ),
      ctaUrl: canonicalUrl,
    },
    {
      platform: "youtube",
      format: "long",
      transport: "official_api",
      title: truncateForLimit(rawTitle, 100),
      body: truncateForLimit(
        `${tldr}\n\nPembahasan:\n${coreBullets}\n\nArtikel & referensi: ${canonicalUrl}`,
        4900,
      ),
      tags,
      ctaUrl: canonicalUrl,
      media: [baseMediaLongVideo],
    },
    {
      platform: "instagram",
      format: "carousel",
      transport: "official_api",
      body: truncateForLimit(
        `${rawTitle}\n\nGeser slide untuk membedah 3 prinsip utamanya.\n\n${tldr}\n\nLink bacaan lengkap ada di bio / ${canonicalUrl}`,
        2150,
      ),
      tags: tags.slice(0, 12),
      ctaUrl: canonicalUrl,
      media: carouselImages,
    },
    {
      platform: "tiktok",
      format: "video",
      transport: "cdp_draft",
      useTrendingAudio: true,
      body: truncateForLimit(
        `Jangan asal eksekusi sebelum paham pola ini: ${firstSentence}\n\nCek tulisan lengkap di ${canonicalUrl}`,
        2150,
      ),
      tags: tags.slice(0, 8),
      ctaUrl: canonicalUrl,
      media: [baseMediaVideo],
    },
  ];

  const bundle: PublishBundle = {
    schemaVersion: "1.0",
    episodeId,
    title: rawTitle,
    pillar: typeof attributes.pillar === "string" ? attributes.pillar : "Tabligh",
    sourcePath: filePath,
    sourceType: "markdown",
    canonicalUrl,
    targets,
  };

  return enrichBundleWithUtm(bundle);
}

function ingestVideoManifest(manifestPath: string, options: IngestOptions): PublishBundle {
  const raw = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as VideoManifestInput;
  const baseDir = path.dirname(manifestPath);
  const title = raw.title || "Untitled Short Episode";
  const episodeId = options.episodeId
    ? slugify(options.episodeId)
    : raw.episodeId
      ? slugify(raw.episodeId)
      : `ep-${slugify(title)}`;
  const baseUrl = (options.canonicalBaseUrl ?? "https://ridlo.id").replace(/\/+$/, "");
  const canonicalUrl = raw.canonicalUrl ?? `${baseUrl}/posts/${episodeId}`;
  const tags = raw.tags ?? ["tabligh-os", "short-form", "indonesia"];

  const resolvedVideoPath = path.isAbsolute(raw.videoPath)
    ? raw.videoPath
    : path.relative(process.cwd(), path.resolve(baseDir, raw.videoPath));

  const videoAsset: MediaAsset = {
    path: resolvedVideoPath,
    type: "video",
    width: raw.width ?? 1080,
    height: raw.height ?? 1920,
    durationSec: raw.durationSec ?? 55,
  };

  const hook = raw.hook ?? title;
  const summary = raw.summary ?? raw.transcript ?? title;

  const targets: PlatformTarget[] = [
    {
      platform: "youtube",
      format: "shorts",
      transport: "official_api",
      title: truncateForLimit(title, 100),
      body: truncateForLimit(`${hook}\n\n${summary}\n\nReferensi lengkap: ${canonicalUrl}`, 4900),
      tags,
      ctaUrl: canonicalUrl,
      media: [videoAsset],
    },
    {
      platform: "instagram",
      format: "reels",
      transport: raw.useTrendingAudio ? "cdp_draft" : "official_api",
      useTrendingAudio: raw.useTrendingAudio ?? true,
      body: truncateForLimit(`${hook}\n\n${summary}\n\nDetail: ${canonicalUrl}`, 2150),
      tags: tags.slice(0, 12),
      ctaUrl: canonicalUrl,
      media: [videoAsset],
    },
    {
      platform: "tiktok",
      format: "video",
      transport: "cdp_draft",
      useTrendingAudio: true,
      body: truncateForLimit(`${hook}\n\n${summary}\n\nBaca selengkapnya: ${canonicalUrl}`, 2150),
      tags: tags.slice(0, 8),
      ctaUrl: canonicalUrl,
      media: [videoAsset],
    },
    {
      platform: "x",
      format: "thread",
      transport: "official_api",
      body: truncateForLimit(`${hook} — ${canonicalUrl}`, 280),
      threadItems: [
        truncateForLimit(`${hook}\n\nRangkuman cepat 60 detik:`, 260),
        truncateForLimit(summary, 260),
        truncateForLimit(`Simak catatan lengkap & link sumber: ${canonicalUrl}`, 260),
      ],
      tags: tags.slice(0, 4),
      ctaUrl: canonicalUrl,
    },
    {
      platform: "linkedin",
      format: "post",
      transport: "official_api",
      body: truncateForLimit(`${title}\n\n${hook}\n\n${summary}\n\n${canonicalUrl}`, 2950),
      tags: tags.slice(0, 5),
      ctaUrl: canonicalUrl,
    },
    {
      platform: "threads",
      format: "post",
      transport: "official_api",
      body: truncateForLimit(`${hook}\n\n${summary}\n\n${canonicalUrl}`, 480),
      ctaUrl: canonicalUrl,
    },
    {
      platform: "whatsapp_channel",
      format: "broadcast",
      transport: "official_api",
      body: truncateForLimit(`*${title}*\n\n${hook}\n\n${summary}\n\n${canonicalUrl}`, 4000),
      ctaUrl: canonicalUrl,
    },
  ];

  const bundle: PublishBundle = {
    schemaVersion: "1.0",
    episodeId,
    title,
    pillar: raw.pillar ?? "Tabligh",
    sourcePath: manifestPath,
    sourceType: "video_manifest",
    canonicalUrl,
    targets,
  };

  return enrichBundleWithUtm(bundle);
}

/**
 * Ingests either a Markdown essay/note (`.md`, compatible with `ridlo.id` frontmatter)
 * or a 9:16 video manifest folder/file (compatible with `agentic-content-studio`)
 * and produces a multi-platform `publish.json` bundle with edge-funnel UTM parameters.
 */
export function ingestSource(inputPath: string, options: IngestOptions = {}): PublishBundle {
  const resolved = path.resolve(inputPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Input source not found: ${inputPath}`);
  }

  const stat = fs.statSync(resolved);
  if (stat.isDirectory()) {
    const manifestCandidate = path.join(resolved, "manifest.json");
    if (fs.existsSync(manifestCandidate)) {
      return ingestVideoManifest(manifestCandidate, options);
    }
    const mdFiles = fs.readdirSync(resolved).filter((f) => f.endsWith(".md"));
    if (mdFiles.length > 0) {
      return ingestMarkdown(path.join(resolved, mdFiles[0]!), options);
    }
    throw new Error(`Directory '${inputPath}' contains neither manifest.json nor .md files.`);
  }

  if (resolved.endsWith(".json")) {
    return ingestVideoManifest(resolved, options);
  }

  return ingestMarkdown(resolved, options);
}
