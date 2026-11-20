import fs from "node:fs";
import type { MediaAsset, PlatformFormat, PlatformId } from "../types.js";

export interface ImageDimensions {
  format: "png" | "jpeg";
  width: number;
  height: number;
}

export type ExpectedAspectLabel = "9:16" | "16:9" | "1:1" | "4:5";

const ASPECT_RATIOS: Record<ExpectedAspectLabel, number> = {
  "9:16": 9 / 16,
  "16:9": 16 / 9,
  "1:1": 1,
  "4:5": 4 / 5,
};

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ASPECT_TOLERANCE = 0.03;

/**
 * Parses width and height from a PNG IHDR chunk or JPEG SOF0/SOF1/SOF2 marker.
 */
export function parseImageDimensions(buffer: Buffer): ImageDimensions | null {
  // Check PNG signature + IHDR chunk
  if (buffer.length >= 24 && buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    const chunkType = buffer.subarray(12, 16).toString("ascii");
    if (chunkType === "IHDR") {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      if (width > 0 && height > 0) {
        return { format: "png", width, height };
      }
    }
  }

  // Check JPEG SOI marker (0xFFD8)
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 4 <= buffer.length) {
      while (offset < buffer.length && buffer[offset] === 0xff) {
        offset += 1;
      }
      if (offset >= buffer.length) {
        break;
      }
      const marker = buffer[offset]!;
      offset += 1;

      // Standalone markers without length field (SOI, EOI, RSTn, TEM)
      if (marker === 0x00 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
        continue;
      }

      if (offset + 2 > buffer.length) {
        break;
      }
      const segmentLength = buffer.readUInt16BE(offset);
      if (segmentLength < 2 || offset + segmentLength > buffer.length) {
        break;
      }

      // SOF0 (0xC0), SOF1 (0xC1), SOF2 (0xC2)
      if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
        if (offset + 7 <= buffer.length) {
          const height = buffer.readUInt16BE(offset + 3);
          const width = buffer.readUInt16BE(offset + 5);
          if (width > 0 && height > 0) {
            return { format: "jpeg", width, height };
          }
        }
        break;
      }

      offset += segmentLength;
    }
  }

  return null;
}

/**
 * Resolves media dimensions by reading PNG/JPEG headers from disk when available
 * and falling back to declared metadata dimensions.
 */
export function resolveMediaDimensions(
  asset: MediaAsset,
  resolvedPath?: string,
): { width?: number; height?: number } {
  const pathToCheck = resolvedPath ?? asset.path;
  if (asset.type === "image" && pathToCheck && fs.existsSync(pathToCheck)) {
    try {
      const fd = fs.openSync(pathToCheck, "r");
      try {
        const stat = fs.fstatSync(fd);
        const cap = Math.min(stat.size, 65536);
        const buf = Buffer.allocUnsafe(cap);
        const readLen = fs.readSync(fd, buf, 0, cap, 0);
        const parsed = parseImageDimensions(buf.subarray(0, readLen));
        if (parsed) {
          return { width: parsed.width, height: parsed.height };
        }
      } finally {
        fs.closeSync(fd);
      }
    } catch {
      // Fall back to declared metadata below.
    }
  }

  return { width: asset.width, height: asset.height };
}

export function getExpectedAspectRatios(
  platform: PlatformId,
  format: PlatformFormat,
): ExpectedAspectLabel[] | null {
  if (
    (platform === "youtube" && format === "shorts") ||
    (platform === "instagram" && format === "reels") ||
    (platform === "tiktok" && format === "video")
  ) {
    return ["9:16"];
  }

  if (platform === "youtube" && format === "long") {
    return ["16:9"];
  }

  if (platform === "instagram" && format === "carousel") {
    return ["1:1", "4:5"];
  }

  return null;
}

export function matchesExpectedAspectRatio(
  width: number,
  height: number,
  allowed: ExpectedAspectLabel[],
): { matches: boolean; actualRatio: number } {
  const actualRatio = width / height;
  const matches = allowed.some((label) => {
    const target = ASPECT_RATIOS[label];
    return Math.abs(actualRatio - target) / target <= ASPECT_TOLERANCE;
  });
  return { matches, actualRatio };
}
