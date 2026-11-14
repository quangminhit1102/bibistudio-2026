import { Worker } from "node:worker_threads";
import { join } from "node:path";
import { ApiError } from "../http/errors";
import { CONTENT_LIMITS as L } from "./limits";
import type { SanitizedContent } from "./contracts";
let running = 0;
export async function sanitizePostContent(raw: string): Promise<SanitizedContent> {
  if (typeof raw !== "string" || Buffer.byteLength(raw) > L.inputBytes)
    throw new ApiError(413, "CONTENT_TOO_LARGE", "Nội dung quá lớn");
  if (running >= L.sanitizerConcurrency)
    throw new ApiError(429, "CONTENT_BUSY", "Đang xử lý nội dung, vui lòng thử lại");
  running++;
  try {
    return await new Promise<SanitizedContent>((resolve, reject) => {
      const worker = new Worker(join(__dirname, "sanitize-worker.js"), {
        workerData: raw,
        resourceLimits: { maxOldGenerationSizeMb: 128, stackSizeMb: 4 },
      });
      let done = false;
      const finish = (error: Error | null, value?: SanitizedContent) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        void worker.terminate();
        if (error) reject(error);
        else resolve(value!);
      };
      const timer = setTimeout(
        () =>
          finish(new ApiError(503, "CONTENT_SANITIZER_TIMEOUT", "Xử lý nội dung quá thời gian")),
        L.sanitizerTimeoutMs,
      );
      worker.once("message", (message: { value?: SanitizedContent; error?: string }) => {
        if (message.error)
          finish(
            new ApiError(
              message.error === "CONTENT_TOO_LARGE" ? 413 : 400,
              message.error,
              "Nội dung không hợp lệ hoặc vượt giới hạn",
            ),
          );
        else if (message.value) finish(null, message.value);
        else finish(new ApiError(503, "CONTENT_SANITIZER_FAILED", "Không xử lý được nội dung"));
      });
      worker.once("error", () =>
        finish(new ApiError(503, "CONTENT_SANITIZER_FAILED", "Không xử lý được nội dung")),
      );
      worker.once("exit", () => {
        if (!done)
          finish(new ApiError(503, "CONTENT_SANITIZER_FAILED", "Không xử lý được nội dung"));
      });
    });
  } finally {
    running--;
  }
}
