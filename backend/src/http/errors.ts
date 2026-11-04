import type { ErrorRequestHandler } from "express";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  const badJson =
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    error.type === "entity.parse.failed";
  const tooLarge =
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    error.type === "entity.too.large";
  const safe =
    error instanceof ApiError
      ? error
      : badJson
        ? new ApiError(400, "INVALID_JSON", "Dữ liệu JSON không hợp lệ")
        : tooLarge
          ? new ApiError(413, "PAYLOAD_TOO_LARGE", "Dữ liệu quá lớn")
          : new ApiError(503, "SERVICE_UNAVAILABLE", "Dịch vụ tạm thời không khả dụng");
  res
    .status(safe.status)
    .json({ error: { code: safe.code, message: safe.message }, requestId: res.locals.requestId });
};
