import { z } from "zod";
import { ServiceError } from "../services/errors";
import type { SlipItem } from "../services/contracts";
const safeAmount = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const lineSchema = z.object({
  lineId: z.string().min(1).max(100),
  productId: z.string().min(1).max(200),
  quantity: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  unitPrice: safeAmount,
});
export const slipDraftSchema = z
  .object({
    customerId: z.string().min(1).max(200),
    vatApplied: z.boolean(),
    notes: z.string().max(5000),
    items: z.array(lineSchema).min(1).max(100),
  })
  .superRefine((value, ctx) => {
    if (
      new Set(value.items.map((i) => i.productId)).size !== value.items.length ||
      new Set(value.items.map((i) => i.lineId)).size !== value.items.length
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["items"],
        message: "Mỗi sản phẩm chỉ có một dòng trên phiếu.",
      });
  });
export type SlipDraft = z.infer<typeof slipDraftSchema>;
export function calculateSlipTotal(items: Pick<SlipItem, "quantity" | "unitPrice">[]): number {
  if (!items.length || items.length > 100)
    throw new ServiceError("validation", "Phiếu cần từ 1 đến 100 dòng.");
  let total = 0;
  for (const item of items) {
    if (
      !Number.isSafeInteger(item.quantity) ||
      item.quantity < 1 ||
      !Number.isSafeInteger(item.unitPrice) ||
      item.unitPrice < 0
    )
      throw new ServiceError(
        "validation",
        "Số lượng phải nguyên dương, đơn giá là số VND nguyên không âm.",
      );
    const lineTotal = item.quantity * item.unitPrice;
    if (!Number.isSafeInteger(lineTotal) || !Number.isSafeInteger(total + lineTotal))
      throw new ServiceError("validation", "Giá trị phiếu vượt giới hạn số an toàn.");
    total += lineTotal;
  }
  return total;
}
export function parseSlipDraft(input: SlipDraft): SlipDraft {
  const parsed = slipDraftSchema.safeParse(input);
  if (!parsed.success)
    throw new ServiceError(
      "validation",
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    );
  calculateSlipTotal(parsed.data.items);
  return parsed.data;
}
