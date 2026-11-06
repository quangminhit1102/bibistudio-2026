import { Worker } from "node:worker_threads";
import { join } from "node:path";
import { ApiError } from "../http/errors";
import { avatarHeader } from "./avatar-header";
export interface NormalizedAvatar {
  bytes: Buffer;
  format: "jpeg" | "png";
  width: number;
  height: number;
}
export function createAvatarNormalizer({ timeoutMs = 5000 }: { timeoutMs?: number } = {}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 5000)
    throw new Error("Invalid avatar worker timeout");
  let busy = false;
  return async (bytes: Buffer, mime: string): Promise<NormalizedAvatar> => {
    if (busy) throw new ApiError(429, "AVATAR_BUSY", "Đang xử lý ảnh. Vui lòng thử lại");
    const header = avatarHeader(bytes, mime);
    busy = true;
    return new Promise((resolve, reject) => {
      let settled = false,
        worker: Worker | undefined,
        timer: ReturnType<typeof setTimeout> | undefined;
      const finish = async (error: Error | null, result?: NormalizedAvatar) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        if (worker) await worker.terminate().catch(() => {});
        busy = false;
        if (error) reject(error);
        else resolve(result!);
      };
      try {
        worker = new Worker(join(__dirname, "avatar-worker.js"), {
          workerData: { bytes, header },
          resourceLimits: { maxOldGenerationSizeMb: 128, stackSizeMb: 4 },
        });
        timer = setTimeout(
          () =>
            void finish(
              new ApiError(503, "AVATAR_TIMEOUT", "Xử lý ảnh quá lâu. Hãy thử ảnh nhỏ hơn"),
            ),
          timeoutMs,
        );
        worker.once("message", (message) => {
          if (!message.ok) {
            void finish(
              new ApiError(message.limit ? 413 : 422, "INVALID_AVATAR", "Không xử lý được ảnh này"),
            );
            return;
          }
          const result = {
            ...message.image,
            bytes: Buffer.from(message.image.bytes),
          } as NormalizedAvatar;
          if (
            !result.bytes.length ||
            result.bytes.length > 2097152 ||
            !Number.isInteger(result.width) ||
            !Number.isInteger(result.height) ||
            result.width < 1 ||
            result.height < 1 ||
            result.width > 512 ||
            result.height > 512 ||
            result.format !== header.format
          )
            void finish(new ApiError(422, "INVALID_AVATAR", "Không xử lý được ảnh này"));
          else void finish(null, result);
        });
        worker.once(
          "error",
          () =>
            void finish(
              new ApiError(503, "AVATAR_PROCESSING_FAILED", "Không xử lý được ảnh lúc này"),
            ),
        );
        worker.once("exit", () => {
          if (!settled)
            void finish(
              new ApiError(503, "AVATAR_PROCESSING_FAILED", "Không xử lý được ảnh lúc này"),
            );
        });
      } catch {
        void finish(new ApiError(503, "AVATAR_PROCESSING_FAILED", "Không xử lý được ảnh lúc này"));
      }
    });
  };
}
export const normalizeAvatar = createAvatarNormalizer();
