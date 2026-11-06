import { z } from "zod";
import { ApiError } from "../http/errors";
export function normalizePhone(value: unknown): string | null {
  if (value === null || value === undefined || (typeof value === "string" && !value.trim()))
    return null;
  if (typeof value !== "string" || value.length > 32)
    throw new ApiError(400, "INVALID_PHONE", "Số điện thoại không hợp lệ");
  const phone = value.replace(/[\s()-]/g, "");
  if (!/^\+?\d{7,15}$/.test(phone))
    throw new ApiError(400, "INVALID_PHONE", "Nhập số điện thoại từ7 đến15chữ số");
  return phone;
}
export const phoneSchema = z
  .string()
  .max(32)
  .nullable()
  .optional()
  .transform((value) => (value === undefined ? undefined : normalizePhone(value)));
