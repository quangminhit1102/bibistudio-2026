import type { PrincipalDto } from "../http/contracts";
import { ApiError } from "../http/errors";
export function hasPermission(principal: PrincipalDto, code: string): boolean {
  return principal.fullAccess || principal.permissions.includes(code);
}
export function assertPermission(principal: PrincipalDto, code: string): void {
  if (!hasPermission(principal, code))
    throw new ApiError(403, "FORBIDDEN", "Bạn không có quyền thực hiện thao tác này");
}
