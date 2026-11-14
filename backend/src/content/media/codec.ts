import { Worker } from "node:worker_threads";
import { join } from "node:path";
import { ApiError } from "../../http/errors";
import { CONTENT_LIMITS as L } from "../limits";
export interface EncodedContentVariant {
  name: string;
  data: Buffer;
  hash: string;
  width: number;
  height: number;
}
export interface EncodedContentImage {
  width: number;
  height: number;
  variants: EncodedContentVariant[];
}
let running = 0;
export function activeContentRequest(signal?: AbortSignal): void {
  if (signal?.aborted) throw new ApiError(408, "REQUEST_ABORTED", "Yêu cầu đã bị hủy");
}
export async function normalizeContentImage(
  bytes: Buffer,
  mimeType: string,
  signal?: AbortSignal,
): Promise<EncodedContentImage> {
  activeContentRequest(signal);
  if (!Buffer.isBuffer(bytes) || !bytes.length)
    throw new ApiError(400, "CONTENT_IMAGE_REQUIRED", "Vui lòng chọn ảnh");
  if (bytes.length > L.mediaBytes)
    throw new ApiError(413, "CONTENT_IMAGE_TOO_LARGE", "Dùng ảnh tối đa5MiB và16MP");
  if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType))
    throw new ApiError(415, "CONTENT_IMAGE_FORMAT", "Dùng ảnh JPEG, PNG hoặc WebP");
  if (running) throw new ApiError(429, "CONTENT_IMAGE_BUSY", "Đang xử lý ảnh, vui lòng thử lại");
  running++;
  try {
    return await new Promise<EncodedContentImage>((resolve, reject) => {
      const worker = new Worker(join(__dirname, "worker.js"), {
        workerData: { bytes, mimeType },
        resourceLimits: { maxOldGenerationSizeMb: 128, stackSizeMb: 4 },
      });
      let done = false;
      const finish = (error: Error | null, value?: EncodedContentImage) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        void worker.terminate();
        if (error) reject(error);
        else resolve(value!);
      };
      const abort = () => finish(new ApiError(408, "REQUEST_ABORTED", "Yêu cầu đã bị hủy"));
      const timer = setTimeout(
        () => finish(new ApiError(503, "CONTENT_IMAGE_TIMEOUT", "Xử lý ảnh quá thời gian")),
        15000,
      );
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) abort();
      worker.once(
        "message",
        (message: { value?: EncodedContentImage; status?: number; code?: string }) => {
          if (message.value)
            finish(null, {
              ...message.value,
              variants: message.value.variants.map((variant) => ({
                ...variant,
                data: Buffer.from(variant.data),
              })),
            });
          else
            finish(
              new ApiError(
                message.status ?? 400,
                message.code ?? "INVALID_CONTENT_IMAGE",
                "Ảnh không hợp lệ hoặc vượt giới hạn",
              ),
            );
        },
      );
      worker.once("error", () =>
        finish(new ApiError(503, "CONTENT_IMAGE_FAILED", "Không xử lý được ảnh")),
      );
      worker.once("exit", () => {
        if (!done) finish(new ApiError(503, "CONTENT_IMAGE_FAILED", "Không xử lý được ảnh"));
      });
    });
  } finally {
    running--;
  }
}
