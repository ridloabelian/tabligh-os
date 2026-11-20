import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { inspectMp4Faststart } from "../src/core/mp4-faststart.js";

function makeBox(type: string, payload: Buffer): Buffer {
  const buf = Buffer.alloc(8 + payload.length);
  buf.writeUInt32BE(buf.length, 0);
  buf.write(type, 4, 4, "ascii");
  payload.copy(buf, 8);
  return buf;
}

function makeLargeBox(type: string, payload: Buffer): Buffer {
  const buf = Buffer.alloc(16 + payload.length);
  buf.writeUInt32BE(1, 0);
  buf.write(type, 4, 4, "ascii");
  buf.writeBigUInt64BE(BigInt(buf.length), 8);
  payload.copy(buf, 16);
  return buf;
}

describe("MP4 ISO BMFF moov faststart inspector", () => {
  it("passes when moov appears before mdat (faststart)", () => {
    const mp4 = Buffer.concat([
      makeBox("ftyp", Buffer.from("isom\x00\x00\x02\x00", "latin1")),
      makeBox("moov", Buffer.alloc(16)),
      makeBox("mdat", Buffer.alloc(32)),
    ]);

    const res = inspectMp4Faststart(mp4);
    expect(res.validMp4).toBe(true);
    expect(res.isFastStart).toBe(true);
    expect(res.ftypBrand).toBe("isom");
    expect(res.moovOffset).toBeLessThan(res.mdatOffset!);
  });

  it("rejects non-faststart MP4 when mdat precedes moov and suggests ffmpeg remediation", () => {
    const mp4 = Buffer.concat([
      makeBox("ftyp", Buffer.from("mp42\x00\x00\x00\x00", "latin1")),
      makeBox("mdat", Buffer.alloc(64)),
      makeBox("moov", Buffer.alloc(24)),
    ]);

    const res = inspectMp4Faststart(mp4);
    expect(res.validMp4).toBe(true);
    expect(res.isFastStart).toBe(false);
    expect(res.moovOffset).toBeGreaterThan(res.mdatOffset!);
    expect(res.remediation).toContain("-movflags +faststart");
  });

  it("handles 64-bit largesize boxes and reading directly from disk", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tabligh-mp4-"));
    const filePath = path.join(tmpDir, "large.mp4");
    try {
      const mp4 = Buffer.concat([
        makeBox("ftyp", Buffer.from("isom\x00\x00\x02\x00", "latin1")),
        makeBox("moov", Buffer.alloc(12)),
        makeLargeBox("mdat", Buffer.alloc(40)),
      ]);
      fs.writeFileSync(filePath, mp4);

      const res = inspectMp4Faststart(filePath);
      expect(res.validMp4).toBe(true);
      expect(res.isFastStart).toBe(true);
      expect(res.atoms.map((a) => a.type)).toEqual(["ftyp", "moov", "mdat"]);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("reports missing moov or invalid non-MP4 buffers cleanly", () => {
    const missingMoov = Buffer.concat([
      makeBox("ftyp", Buffer.from("isom\x00\x00\x02\x00", "latin1")),
      makeBox("mdat", Buffer.alloc(20)),
    ]);
    expect(inspectMp4Faststart(missingMoov).validMp4).toBe(false);
    expect(inspectMp4Faststart(Buffer.from("not-an-mp4")).validMp4).toBe(false);
  });
});
