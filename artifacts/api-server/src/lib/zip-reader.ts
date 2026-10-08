import { inflateRawSync } from "node:zlib";

/*
 * A small, strict ZIP reader for admin template uploads.
 *
 * It reads the central directory (so zips written by Windows, macOS, Linux and
 * most tools work, including ones that use "data descriptors"), supports
 * stored and deflated entries, and refuses anything unusual: encryption,
 * ZIP64, symbolic links, and archives that would expand beyond the limits.
 * Sizes are checked from the headers *before* anything is decompressed, and
 * decompression is capped, so a "zip bomb" can't use up memory.
 */

export class ZipError extends Error {}

export type ZipLimits = { maxEntries: number; maxFileBytes: number; maxTotalBytes: number };
export type ZipEntry = { path: string; data: Buffer };

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function findEndOfCentralDirectory(zip: Buffer) {
  const earliest = Math.max(0, zip.length - 22 - 0xffff);
  for (let i = zip.length - 22; i >= earliest; i--) if (zip.readUInt32LE(i) === EOCD) return i;
  throw new ZipError("This doesn't look like a ZIP file.");
}

const mb = (bytes: number) => `${Math.round((bytes / 1024 / 1024) * 10) / 10} MB`;

/** Reads every file in the archive (directories are skipped). Throws ZipError with a plain-language message. */
export function readZip(zip: Buffer, limits: ZipLimits): ZipEntry[] {
  if (zip.length < 22) throw new ZipError("This doesn't look like a ZIP file.");
  const eocd = findEndOfCentralDirectory(zip);
  const total = zip.readUInt16LE(eocd + 10);
  const centralSize = zip.readUInt32LE(eocd + 12);
  const centralOffset = zip.readUInt32LE(eocd + 16);
  if (total === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) throw new ZipError("ZIP64 archives aren't supported. Use a normal ZIP.");
  if (centralOffset + centralSize > zip.length) throw new ZipError("This ZIP file is damaged or incomplete.");
  if (total > limits.maxEntries * 4) throw new ZipError(`This ZIP has too many entries (the limit is ${limits.maxEntries} files).`);

  const entries: ZipEntry[] = [];
  let declaredTotal = 0;
  let cursor = centralOffset;
  for (let index = 0; index < total; index++) {
    if (cursor + 46 > zip.length || zip.readUInt32LE(cursor) !== CENTRAL) throw new ZipError("This ZIP file is damaged.");
    const flags = zip.readUInt16LE(cursor + 8);
    const method = zip.readUInt16LE(cursor + 10);
    const crc = zip.readUInt32LE(cursor + 16);
    const compressedSize = zip.readUInt32LE(cursor + 20);
    const size = zip.readUInt32LE(cursor + 24);
    const nameLength = zip.readUInt16LE(cursor + 28);
    const extraLength = zip.readUInt16LE(cursor + 30);
    const commentLength = zip.readUInt16LE(cursor + 32);
    const attributes = zip.readUInt32LE(cursor + 38);
    const localOffset = zip.readUInt32LE(cursor + 42);
    const name = zip.toString("utf8", cursor + 46, cursor + 46 + nameLength).replaceAll("\\", "/");
    cursor += 46 + nameLength + extraLength + commentLength;

    if (name.endsWith("/")) continue;
    if (/[\u0000-\u001f]/.test(name)) throw new ZipError("A file in this ZIP has an invalid name.");
    if (flags & 1) throw new ZipError("Password-protected ZIPs aren't supported.");
    if (compressedSize === 0xffffffff || size === 0xffffffff || localOffset === 0xffffffff) throw new ZipError("ZIP64 archives aren't supported. Use a normal ZIP.");
    if (((attributes >>> 16) & 0xf000) === 0xa000) throw new ZipError(`“${name}” is a shortcut (symbolic link), which isn't allowed.`);
    if (entries.length >= limits.maxEntries) throw new ZipError(`This ZIP has too many files (the limit is ${limits.maxEntries}).`);
    if (size > limits.maxFileBytes) throw new ZipError(`“${name}” is ${mb(size)}; a single file can be at most ${mb(limits.maxFileBytes)}. Optimise or compress it.`);
    declaredTotal += size;
    if (declaredTotal > limits.maxTotalBytes) throw new ZipError(`The files in this ZIP add up to more than ${mb(limits.maxTotalBytes)} once unpacked. Remove or optimise large files.`);

    if (localOffset + 30 > zip.length || zip.readUInt32LE(localOffset) !== LOCAL) throw new ZipError("This ZIP file is damaged.");
    const start = localOffset + 30 + zip.readUInt16LE(localOffset + 26) + zip.readUInt16LE(localOffset + 28);
    if (start + compressedSize > zip.length) throw new ZipError("This ZIP file is damaged or incomplete.");
    const stored = zip.subarray(start, start + compressedSize);

    let data: Buffer;
    if (method === 0) {
      if (compressedSize !== size) throw new ZipError(`“${name}” is damaged.`);
      data = Buffer.from(stored);
    } else if (method === 8) {
      try {
        data = inflateRawSync(stored, { maxOutputLength: Math.max(1, size) });
      } catch {
        throw new ZipError(`“${name}” is damaged or larger than its header says.`);
      }
    } else {
      throw new ZipError(`“${name}” uses a compression method that isn't supported. Re-create the ZIP with standard compression.`);
    }
    if (data.length !== size || crc32(data) !== crc) throw new ZipError(`“${name}” is damaged (checksum mismatch).`);
    entries.push({ path: name, data });
  }
  return entries;
}
