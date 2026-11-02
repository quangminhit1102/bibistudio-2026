import type { AdminStore, PurchaseSlip } from "../services/contracts";
import { ServiceError } from "../services/errors";
export function slipRouteToken(slip: Pick<PurchaseSlip, "number">): string {
  return slip.number;
}
export async function resolveSlipRoute(store: AdminStore, token: string): Promise<PurchaseSlip> {
  const exact = await store.get("purchaseSlips", token);
  if (exact) return exact;
  const matches = (await store.list("purchaseSlips")).filter((s) => s.number === token);
  if (matches.length > 1)
    throw new ServiceError("conflict", "Số phiếu bị trùng. Vui lòng kiểm tra dữ liệu.");
  if (!matches.length) throw new ServiceError("not-found", "Không tìm thấy phiếu mua hàng.");
  return matches[0];
}
