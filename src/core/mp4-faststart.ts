import fs from "node:fs";

export interface Mp4AtomInfo {
  type: string;
  offset: number;
  size: number;
}

export interface Mp4InspectionResult {
  validMp4: boolean;
  isFastStart: boolean;
  ftypBrand: string | null;
  moovOffset: number | null;
  mdatOffset: number | null;
  atoms: Mp4AtomInfo[];
  error?: string;
  remediation?: string;
}

const PRINTABLE_FOURCC_RE = /^[ -~]{4}$/;

interface BoxSource {
  totalSize: number;
  read(offset: number, length: number): Buffer;
}

function fromBuffer(buf: Buffer): BoxSource {
  return {
    totalSize: buf.length,
    read(offset: number, length: number): Buffer {
      const end = Math.min(buf.length, offset + length);
      return buf.subarray(offset, end);
    },
  };
}

function inspectFromSource(source: BoxSource, sourceLabel: string): Mp4InspectionResult {
  if (source.totalSize < 12) {
    return {
      validMp4: false,
      isFastStart: false,
      ftypBrand: null,
      moovOffset: null,
      mdatOffset: null,
      atoms: [],
      error: "File is smaller than minimum ISO BMFF header (12 bytes).",
    };
  }

  const atoms: Mp4AtomInfo[] = [];
  let offset = 0;
  let ftypBrand: string | null = null;
  let moovOffset: number | null = null;
  let mdatOffset: number | null = null;
  let hasFtyp = false;

  // Cap top-level atom count as a defensive guard against malformed looping streams.
  const MAX_ATOMS = 4096;

  while (offset + 8 <= source.totalSize && atoms.length < MAX_ATOMS) {
    const header = source.read(offset, 16);
    if (header.length < 8) {
      return {
        validMp4: false,
        isFastStart: false,
        ftypBrand,
        moovOffset,
        mdatOffset,
        atoms,
        error: `Truncated MP4 box header at offset ${offset}.`,
      };
    }

    const size32 = header.readUInt32BE(0);
    const type = header.subarray(4, 8).toString("ascii");

    if (!PRINTABLE_FOURCC_RE.test(type)) {
      return {
        validMp4: false,
        isFastStart: false,
        ftypBrand,
        moovOffset,
        mdatOffset,
        atoms,
        error: `Invalid FourCC box type at offset ${offset}.`,
      };
    }

    let boxSize: number;
    let headerSize = 8;

    if (size32 === 1) {
      if (header.length < 16) {
        return {
          validMp4: false,
          isFastStart: false,
          ftypBrand,
          moovOffset,
          mdatOffset,
          atoms,
          error: `Truncated 64-bit largesize header for box '${type}' at offset ${offset}.`,
        };
      }
      const bigSize = header.readBigUInt64BE(8);
      if (bigSize < 16n || bigSize > BigInt(Number.MAX_SAFE_INTEGER)) {
        return {
          validMp4: false,
          isFastStart: false,
          ftypBrand,
          moovOffset,
          mdatOffset,
          atoms,
          error: `Invalid 64-bit largesize (${bigSize.toString()}) for box '${type}' at offset ${offset}.`,
        };
      }
      boxSize = Number(bigSize);
      headerSize = 16;
    } else if (size32 === 0) {
      boxSize = source.totalSize - offset;
    } else if (size32 < 8) {
      return {
        validMp4: false,
        isFastStart: false,
        ftypBrand,
        moovOffset,
        mdatOffset,
        atoms,
        error: `Invalid MP4 box size (${size32}) for '${type}' at offset ${offset}.`,
      };
    } else {
      boxSize = size32;
    }

    if (offset + boxSize > source.totalSize) {
      return {
        validMp4: false,
        isFastStart: false,
        ftypBrand,
        moovOffset,
        mdatOffset,
        atoms,
        error: `Box '${type}' at offset ${offset} extends beyond EOF (${offset + boxSize} > ${source.totalSize}).`,
      };
    }

    if (type === "ftyp") {
      hasFtyp = true;
      if (boxSize >= headerSize + 4) {
        const brandBuf = source.read(offset + headerSize, 4);
        if (brandBuf.length === 4) {
          ftypBrand = brandBuf.toString("ascii");
        }
      }
    } else if (type === "moov" && moovOffset === null) {
      moovOffset = offset;
    } else if (type === "mdat" && mdatOffset === null) {
      mdatOffset = offset;
    }

    atoms.push({ type, offset, size: boxSize });
    offset += boxSize;
  }

  if (!hasFtyp) {
    return {
      validMp4: false,
      isFastStart: false,
      ftypBrand,
      moovOffset,
      mdatOffset,
      atoms,
      error: "Missing 'ftyp' box: file is not a valid MP4/ISO BMFF container.",
    };
  }

  if (moovOffset === null) {
    return {
      validMp4: false,
      isFastStart: false,
      ftypBrand,
      moovOffset,
      mdatOffset,
      atoms,
      error: "Missing 'moov' atom: MP4 container metadata is absent or corrupted.",
    };
  }

  if (mdatOffset === null) {
    return {
      validMp4: true,
      isFastStart: true,
      ftypBrand,
      moovOffset,
      mdatOffset,
      atoms,
    };
  }

  const isFastStart = moovOffset < mdatOffset;
  if (!isFastStart) {
    return {
      validMp4: true,
      isFastStart: false,
      ftypBrand,
      moovOffset,
      mdatOffset,
      atoms,
      error: `MP4 is not faststart-ready ('moov' at byte ${moovOffset} appears after 'mdat' at byte ${mdatOffset}).`,
      remediation: `ffmpeg -i "${sourceLabel}" -c copy -movflags +faststart "${sourceLabel}.faststart.mp4"`,
    };
  }

  return {
    validMp4: true,
    isFastStart: true,
    ftypBrand,
    moovOffset,
    mdatOffset,
    atoms,
  };
}

/**
 * Inspects top-level MP4/MOV ISO BMFF boxes to verify `ftyp`, `moov`, and `mdat`
 * structure and guarantee `moov` appears before `mdat` (faststart) without
 * loading large video payloads into RAM.
 */
export function inspectMp4Faststart(filePathOrBuffer: string | Buffer): Mp4InspectionResult {
  if (Buffer.isBuffer(filePathOrBuffer)) {
    return inspectFromSource(fromBuffer(filePathOrBuffer), "input.mp4");
  }

  let fd: number | null = null;
  try {
    fd = fs.openSync(filePathOrBuffer, "r");
    const stat = fs.fstatSync(fd);
    const source: BoxSource = {
      totalSize: stat.size,
      read(offset: number, length: number): Buffer {
        const toRead = Math.max(0, Math.min(length, stat.size - offset));
        const buf = Buffer.allocUnsafe(toRead);
        if (toRead === 0) {
          return buf;
        }
        const bytesRead = fs.readSync(fd!, buf, 0, toRead, offset);
        return buf.subarray(0, bytesRead);
      },
    };
    return inspectFromSource(source, filePathOrBuffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      validMp4: false,
      isFastStart: false,
      ftypBrand: null,
      moovOffset: null,
      mdatOffset: null,
      atoms: [],
      error: `Unable to read MP4 file '${filePathOrBuffer}': ${message}`,
    };
  } finally {
    if (fd !== null) {
      fs.closeSync(fd);
    }
  }
}
