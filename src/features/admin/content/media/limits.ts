import { ServiceError } from "../../services/errors";
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export async function validateImageFile(file: File) {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > MAX_IMAGE_BYTES ||
    file.size === 0
  )
    throw new ServiceError("validation", "Chỉ nhận JPEG, PNG, WebP tối đa5MiB mỗi ảnh.");
  const b = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const png =
    b[0] === 137 && b[1] === 80 && b[2] === 78 && b[3] === 71 && b[4] === 13 && b[5] === 10;
  const jpeg = b[0] === 255 && b[1] === 216 && b[2] === 255;
  const webp =
    String.fromCharCode(...b.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...b.slice(8, 12)) === "WEBP";
  if (!(file.type === "image/png" ? png : file.type === "image/jpeg" ? jpeg : webp))
    throw new ServiceError("validation", "Nội dung file không khớp định dạng ảnh.");
}
