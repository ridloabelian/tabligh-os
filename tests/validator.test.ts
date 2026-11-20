import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { computeContentHash, resolveEffectiveTransport, validateBundle } from "../src/core/validator.js";
import type { PublishBundle } from "../src/types.js";

function makeMp4Buffer(fastStart: boolean): Buffer {
  const box = (t: string, len: number) => {
    const b = Buffer.alloc(8 + len);
    b.writeUInt32BE(b.length, 0);
    b.write(t, 4, 4, "ascii");
    return b;
  };
  const ftyp = Buffer.concat([
    (() => {
      const b = Buffer.alloc(16);
      b.writeUInt32BE(16, 0);
      b.write("ftypisom", 4, 8, "ascii");
      return b;
    })(),
  ]);
  const moov = box("moov", 12);
  const mdat = box("mdat", 32);
  return fastStart ? Buffer.concat([ftyp, moov, mdat]) : Buffer.concat([ftyp, mdat, moov]);
}

function makePngBuffer(width: number, height: number): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0);
  ihdr.write("IHDR", 4, 4, "ascii");
  ihdr.writeUInt32BE(width, 8);
  ihdr.writeUInt32BE(height, 12);
  ihdr[16] = 8;
  ihdr[17] = 2;
  return Buffer.concat([sig, ihdr]);
}

describe("deterministic validator", () => {
  it("enforces character limits across X, LinkedIn, YouTube, Threads, and TikTok", () => {
    const bundle: PublishBundle = {
      schemaVersion: "1.0",
      episodeId: "ep-limits",
      title: "Limits Check",
      pillar: "Tabligh",
      sourceType: "manual",
      targets: [
        { platform: "x", format: "tweet", body: "a".repeat(281) },
        { platform: "linkedin", format: "post", body: "b".repeat(3001) },
        {
          platform: "youtube",
          format: "long",
          title: "c".repeat(101),
          body: "Valid desc",
          media: [{ path: "v.mp4", type: "video", width: 1920, height: 1080 }],
        },
        { platform: "threads", format: "post", body: "d".repeat(501) },
        {
          platform: "tiktok",
          format: "video",
          body: "e".repeat(2201),
          media: [{ path: "v.mp4", type: "video", width: 1080, height: 1920 }],
        },
      ],
    };

    const report = validateBundle(bundle, { checkFilesOnDisk: false });
    expect(report.valid).toBe(false);
    expect(report.errors.filter((e) => e.code === "CHAR_LIMIT_EXCEEDED")).toHaveLength(5);
  });

  it("rejects unfilled placeholders, forbidden phrases, and duplicate SHA-256 content hashes", () => {
    const target = {
      platform: "linkedin" as const,
      format: "post" as const,
      body: "Ini TODO {{slug}} dengan klaim 100% pasti untung!",
    };
    const bundle: PublishBundle = {
      schemaVersion: "1.0",
      episodeId: "ep-bad-text",
      title: "Bad Text",
      pillar: "Tabligh",
      sourceType: "manual",
      targets: [target],
    };
    const hash = computeContentHash(bundle.episodeId, target);
    const report = validateBundle(bundle, {
      checkFilesOnDisk: false,
      existingPublishedHashes: new Set([`linkedin:${hash}`]),
    });

    const codes = new Set(report.errors.map((e) => e.code));
    expect(codes.has("UNFILLED_PLACEHOLDER")).toBe(true);
    expect(codes.has("FORBIDDEN_WORD")).toBe(true);
    expect(codes.has("DUPLICATE_CONTENT_HASH")).toBe(true);
  });

  it("validates binary PNG aspect ratio and rejects non-faststart MP4 on disk", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tabligh-val-"));
    try {
      const badMp4 = path.join(tmpDir, "bad.mp4");
      const wrongAspectPng = path.join(tmpDir, "landscape.png");
      fs.writeFileSync(badMp4, makeMp4Buffer(false));
      fs.writeFileSync(wrongAspectPng, makePngBuffer(1920, 1080));

      const bundle: PublishBundle = {
        schemaVersion: "1.0",
        episodeId: "ep-media",
        title: "Media Check",
        pillar: "Tabligh",
        sourceType: "manual",
        targets: [
          {
            platform: "tiktok",
            format: "video",
            body: "Vertical short",
            media: [{ path: badMp4, type: "video", width: 1080, height: 1920 }],
          },
          {
            platform: "instagram",
            format: "carousel",
            body: "Carousel check",
            media: [
              { path: wrongAspectPng, type: "image" },
              { path: wrongAspectPng, type: "image" },
            ],
          },
        ],
      };

      const report = validateBundle(bundle, { checkFilesOnDisk: true });
      const codes = new Set(report.errors.map((e) => e.code));
      expect(codes.has("MP4_NOT_FASTSTART")).toBe(true);
      expect(codes.has("ASPECT_RATIO_MISMATCH")).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("forces cdp_draft transport for TikTok and Instagram with trending audio", () => {
    expect(resolveEffectiveTransport({ platform: "tiktok", format: "video", body: "hi" })).toBe("cdp_draft");
    expect(
      resolveEffectiveTransport({
        platform: "instagram",
        format: "reels",
        useTrendingAudio: true,
        body: "hi",
      }),
    ).toBe("cdp_draft");
    expect(resolveEffectiveTransport({ platform: "x", format: "tweet", body: "hi" })).toBe("official_api");
  });
});
