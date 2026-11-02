export type ErrorCode =
  "validation" | "not-found" | "forbidden" | "conflict" | "storage" | "aborted";
export class ServiceError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}
export function storageError(error: unknown): ServiceError {
  return error instanceof ServiceError
    ? error
    : new ServiceError(
        "storage",
        `Không thể lưu dữ liệu. Kiểm tra dung lượng/quyền lưu trữ rồi thử lại. ${error instanceof Error ? error.message : ""}`,
      );
}
export function assertNotAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new ServiceError("aborted", "Đã hủy yêu cầu");
}
