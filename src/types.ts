export type PlatformId =
  | "youtube"
  | "instagram"
  | "tiktok"
  | "x"
  | "linkedin"
  | "threads"
  | "whatsapp_channel"
  | "emdash";

export type PlatformFormat =
  | "long"
  | "shorts"
  | "reels"
  | "carousel"
  | "video"
  | "photo_carousel"
  | "tweet"
  | "thread"
  | "article"
  | "post"
  | "broadcast"
  | "posts"
  | "notes";

export type TransportType = "official_api" | "cdp_draft";

export type JobStatus =
  | "PLANNED"
  | "VALIDATED"
  | "UPLOADING"
  | "SCHEDULED"
  | "PENDING_HUMAN_CLICK"
  | "PUBLISHED"
  | "FAILED";

export interface MediaAsset {
  path: string;
  type: "video" | "image";
  width?: number;
  height?: number;
  durationSec?: number;
  altText?: string;
}

export interface PlatformTarget {
  platform: PlatformId;
  format: PlatformFormat;
  transport?: TransportType;
  scheduledAt?: string;
  title?: string;
  body: string;
  threadItems?: string[];
  tags?: string[];
  ctaUrl?: string;
  useTrendingAudio?: boolean;
  slug?: string;
  collection?: "posts" | "notes";
  excerpt?: string;
  tldr?: string;
  media?: MediaAsset[];
}

export interface PublishBundle {
  schemaVersion: "1.0";
  episodeId: string;
  title: string;
  pillar: string;
  sourcePath?: string;
  sourceType: "markdown" | "video_manifest" | "manual" | "demo";
  canonicalUrl?: string;
  forbiddenWords?: string[];
  targets: PlatformTarget[];
}

export interface ValidationIssue {
  code: string;
  severity: "error" | "warning";
  platform?: PlatformId;
  format?: PlatformFormat;
  field?: string;
  message: string;
  remediation?: string;
}

export interface TargetValidationResult {
  platform: PlatformId;
  format: PlatformFormat;
  effectiveTransport: TransportType;
  contentHash: string;
  valid: boolean;
  issues: ValidationIssue[];
}

export interface ValidationReport {
  valid: boolean;
  episodeId: string;
  checkedAt: string;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  targets: TargetValidationResult[];
}

export interface EpisodeRecord {
  episodeId: string;
  title: string;
  pillar: string;
  sourceType: PublishBundle["sourceType"];
  sourcePath: string | null;
  canonicalUrl: string | null;
  bundleJson: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformJobRecord {
  id: number;
  episodeId: string;
  platform: PlatformId;
  format: PlatformFormat;
  transport: TransportType;
  status: JobStatus;
  contentHash: string;
  scheduledAt: string | null;
  publishedUrl: string | null;
  externalId: string | null;
  stagingPath: string | null;
  studioUrl: string | null;
  lastError: string | null;
  payloadJson: string;
  createdAt: string;
  updatedAt: string;
}

export interface JobEventRecord {
  id: number;
  jobId: number;
  episodeId: string;
  platform: PlatformId;
  fromStatus: JobStatus | null;
  toStatus: JobStatus;
  message: string;
  createdAt: string;
}

export interface NotificationLogRecord {
  id: number;
  episodeId: string;
  channel: "waflare" | "telegram";
  status: "sent" | "skipped" | "failed";
  summary: string;
  responseCode: number | null;
  error: string | null;
  createdAt: string;
}

export const ALL_PLATFORMS: readonly PlatformId[] = [
  "youtube",
  "instagram",
  "tiktok",
  "x",
  "linkedin",
  "threads",
  "whatsapp_channel",
  "emdash",
] as const;

export const PLATFORM_LABELS: Record<PlatformId, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  tiktok: "TikTok",
  x: "X",
  linkedin: "LinkedIn",
  threads: "Threads",
  whatsapp_channel: "WhatsApp Channel",
  emdash: "EmDash CMS",
};

export const PLATFORM_STUDIO_URLS: Record<PlatformId, string> = {
  youtube: "https://studio.youtube.com",
  instagram: "https://www.instagram.com/",
  tiktok: "https://www.tiktok.com/tiktokstudio/upload",
  x: "https://x.com/compose/post",
  linkedin: "https://www.linkedin.com/feed/",
  threads: "https://www.threads.net/",
  whatsapp_channel: "https://web.whatsapp.com/",
  emdash: "https://ridlo.id/_emdash/admin",
};
