import { ServiceError } from "../../services/errors";
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_MEDIA_BYTES = 2 * 1024 * 1024;
const isPng = (b: Uint8Array) =>
  b[0] === 137 && b[1] === 80 && b[2] === 78 && b[3] === 71 && b[4] === 13 && b[5] === 10;
const isJpeg = (b: Uint8Array) => b[0] === 255 && b[1] === 216 && b[2] === 255;
const isWebp = (b: Uint8Array) =>
  String.fromCharCode(...b.slice(0, 4)) === "RIFF" &&
  String.fromCharCode(...b.slice(8, 12)) === "WEBP";
export async function validateImageFile(file: File) {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > MAX_IMAGE_BYTES ||
    file.size === 0
  )
    throw new ServiceError("validation", "Chỉ nhận JPEG, PNG, WebP tối đa5MiB mỗi ảnh.");
  const b = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (!(file.type === "image/png" ? isPng(b) : file.type === "image/jpeg" ? isJpeg(b) : isWebp(b)))
    throw new ServiceError("validation", "Nội dung file không khớp định dạng ảnh.");
}
export async function validateMediaUpload(file: File) {
  if (
    !["image/jpeg", "image/png"].includes(file.type) ||
    file.size > MAX_MEDIA_BYTES ||
    file.size === 0
  )
    throw new ServiceError("validation", "Chỉ nhận JPEG, PNG tối đa2 MiB mỗi ảnh.");
  const b = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (!(file.type === "image/png" ? isPng(b) : isJpeg(b)))
    throw new ServiceError("validation", "Nội dung file không khớp định dạng ảnh.");
}
