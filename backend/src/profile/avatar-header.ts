import { crc32 } from "node:zlib";
import { ApiError } from "../http/errors";
export interface ImageHeader {
  format: "jpeg" | "png";
  width: number;
  height: number;
  orientation: number;
}
const invalid = () => new ApiError(422, "INVALID_AVATAR", "Ảnh không hợp lệ hoặc đã bị hỏng");
const unsupported = () =>
  new ApiError(415, "AVATAR_FORMAT", "Dùng ảnh JPEG hoặc PNG8bit tĩnh, không xen kẽ");
function dimensions(width: number, height: number) {
  if (!width || !height) throw invalid();
  if (width * height > 16000000)
    throw new ApiError(413, "AVATAR_TOO_LARGE", "Ảnh tối đa16triệu pixel");
}
function png(bytes: Buffer): ImageHeader {
  if (
    bytes.length < 33 ||
    bytes.readUInt32BE(8) !== 13 ||
    bytes.toString("ascii", 12, 16) !== "IHDR"
  )
    throw invalid();
  const width = bytes.readUInt32BE(16),
    height = bytes.readUInt32BE(20);
  dimensions(width, height);
  if (bytes[24] !== 8 || bytes[28] !== 0) throw unsupported();
  if (![0, 2, 3, 4, 6].includes(bytes[25]) || bytes[26] !== 0 || bytes[27] !== 0) throw invalid();
  let cursor = 8,
    count = 0,
    ended = false,
    hasData = false;
  while (cursor < bytes.length) {
    if (++count > 4096 || cursor + 12 > bytes.length) throw invalid();
    const size = bytes.readUInt32BE(cursor),
      end = cursor + 12 + size;
    if (end > bytes.length) throw invalid();
    const name = bytes.toString("ascii", cursor + 4, cursor + 8);
    if (!/^[a-zA-Z]{4}$/.test(name) || (name === "IHDR" && cursor !== 8)) throw invalid();
    if (name === "acTL" || name === "fcTL" || name === "fdAT") throw unsupported();
    if (crc32(bytes.subarray(cursor + 4, end - 4)) !== bytes.readUInt32BE(end - 4)) throw invalid();
    if (name === "IDAT") hasData = true;
    if (name === "IEND") {
      if (size !== 0 || end !== bytes.length) throw invalid();
      ended = true;
    }
    cursor = end;
  }
  if (!ended || !hasData) throw invalid();
  return { format: "png", width, height, orientation: 1 };
}
function exif(bytes: Buffer): number {
  if (bytes.length < 14) throw invalid();
  const tiff = bytes.subarray(6),
    little = tiff.toString("ascii", 0, 2) === "II";
  if (!little && tiff.toString("ascii", 0, 2) !== "MM") throw invalid();
  const u16 = (at: number) => {
    if (at < 0 || at + 2 > tiff.length) throw invalid();
    return little ? tiff.readUInt16LE(at) : tiff.readUInt16BE(at);
  };
  const u32 = (at: number) => {
    if (at < 0 || at + 4 > tiff.length) throw invalid();
    return little ? tiff.readUInt32LE(at) : tiff.readUInt32BE(at);
  };
  if (u16(2) !== 42) throw invalid();
  const start = u32(4),
    count = u16(start);
  if (count > 256 || start + 2 + count * 12 + 4 > tiff.length) throw invalid();
  for (let i = 0; i < count; i++) {
    const at = start + 2 + i * 12;
    if (u16(at) === 0x112) {
      if (u16(at + 2) !== 3 || u32(at + 4) !== 1) throw invalid();
      const value = u16(at + 8);
      if (value < 1 || value > 8) throw invalid();
      return value;
    }
  }
  return 1;
}
function jpg(bytes: Buffer): ImageHeader {
  if (bytes.length < 4 || bytes.at(-2) !== 255 || bytes.at(-1) !== 217) throw invalid();
  let cursor = 2,
    width = 0,
    height = 0,
    orientation = 1;
  while (cursor < bytes.length) {
    if (bytes[cursor++] !== 255) throw invalid();
    while (bytes[cursor] === 255) cursor++;
    const marker = bytes[cursor++];
    if (cursor + 2 > bytes.length) throw invalid();
    const length = bytes.readUInt16BE(cursor),
      start = cursor + 2,
      end = cursor + length;
    if (length < 2 || end > bytes.length) throw invalid();
    if (marker === 218) {
      if (!width) throw invalid();
      return { format: "jpeg", width, height, orientation };
    }
    if ([192, 193, 194].includes(marker)) {
      if (width || length < 8 || bytes[start] !== 8) throw invalid();
      height = bytes.readUInt16BE(start + 1);
      width = bytes.readUInt16BE(start + 3);
      dimensions(width, height);
    }
    if (marker === 225 && bytes.toString("latin1", start, start + 6) === "Exif\0\0")
      orientation = exif(bytes.subarray(start, end));
    cursor = end;
  }
  throw invalid();
}
export function avatarHeader(bytes: Buffer, mime: string): ImageHeader {
  if (bytes.length > 2097152) throw new ApiError(413, "AVATAR_TOO_LARGE", "Ảnh tối đa2MiB");
  if (
    mime === "image/png" &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return png(bytes);
  if (mime === "image/jpeg" && bytes[0] === 255 && bytes[1] === 216) return jpg(bytes);
  throw unsupported();
}
