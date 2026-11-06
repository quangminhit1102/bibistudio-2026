import { PNG } from "pngjs";
import jpeg from "jpeg-js";
import { crc32 } from "node:zlib";
export function pixels(width = 40, height = 60) {
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4;
      data[at] = x < width / 2 ? 220 : 20;
      data[at + 1] = y < height / 2 ? 200 : 20;
      data[at + 2] = 50;
      data[at + 3] = 255;
    }
  return { width, height, data };
}
export const pngImage = (width = 40, height = 60) => PNG.sync.write(pixels(width, height));
export const jpegImage = (width = 40, height = 60) => jpeg.encode(pixels(width, height), 100).data;
export function chunk(type, data) {
  const name = Buffer.from(type),
    header = Buffer.alloc(4),
    checksum = Buffer.alloc(4);
  header.writeUInt32BE(data.length);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([header, name, data, checksum]);
}
export function changeHeader(image, offset, value) {
  const out = Buffer.from(image);
  out[offset] = value;
  out.writeUInt32BE(crc32(out.subarray(12, 29)), 29);
  return out;
}
export function orientedJpeg(orientation) {
  const image = jpegImage(),
    tiff = Buffer.alloc(26);
  tiff.write("II");
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(1, 8);
  tiff.writeUInt16LE(0x112, 10);
  tiff.writeUInt16LE(3, 12);
  tiff.writeUInt32LE(1, 14);
  tiff.writeUInt16LE(orientation, 18);
  const payload = Buffer.concat([Buffer.from("Exif\0\0"), tiff]),
    header = Buffer.from([255, 225, 0, 0]);
  header.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([image.subarray(0, 2), header, payload, image.subarray(2)]);
}
