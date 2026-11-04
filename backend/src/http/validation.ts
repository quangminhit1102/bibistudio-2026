import type { ZodType } from "zod";
import { ApiError } from "./errors";
export function validate<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ApiError(400, "INVALID_INPUT", "Dữ liệu không hợp lệ");
  return result.data;
}
