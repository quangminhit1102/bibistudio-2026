import type { PoolConnection } from "mysql2/promise";
import type { AccountDto } from "../http/contracts";
import { resolvePrincipal, sqlDate, type UserRow } from "../auth/repository";
export async function accountDto(connection: PoolConnection, user: UserRow): Promise<AccountDto> {
  return {
    ...(await resolvePrincipal(connection, user)),
    active: Boolean(user.active),
    createdAt: sqlDate(String(user.created_at)).toISOString(),
    updatedAt: sqlDate(String(user.updated_at)).toISOString(),
  };
}
