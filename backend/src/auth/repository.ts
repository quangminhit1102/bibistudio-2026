import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import type { PrincipalDto, RoleOptionDto } from "../http/contracts";

export interface UserRow extends RowDataPacket {
  id: string;
  username: string;
  display_name: string;
  email: string | null;
  phone?: string | null;
  avatar_id?: string | null;
  password_hash: string;
  active: number;
  deleted_at: string | null;
  is_master: number | null;
  revision: number;
  auth_version: number;
}
export interface SessionRow extends RowDataPacket {
  id: string;
  user_id: string;
  auth_version: number;
  revoked_at: string | null;
  last_activity_at: string;
  idle_expires_at: string;
  absolute_expires_at: string;
}
export const sqlDate = (value: string): Date => new Date(value.replace(" ", "T") + "Z");
export async function resolvePrincipal(
  connection: PoolConnection,
  user: UserRow,
): Promise<PrincipalDto> {
  const [roles] = await connection.execute<RowDataPacket[]>(
    "SELECT r.id,r.name,r.full_access FROM roles r JOIN user_roles ur ON ur.role_id=r.id WHERE ur.user_id=? ORDER BY r.id",
    [user.id],
  );
  const [permissions] = await connection.execute<RowDataPacket[]>(
    "SELECT DISTINCT p.code FROM permissions p JOIN role_permissions rp ON rp.permission_id=p.id JOIN user_roles ur ON ur.role_id=rp.role_id WHERE ur.user_id=? ORDER BY p.code",
    [user.id],
  );
  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    email: user.email,
    phone: user.phone ?? null,
    avatarId: user.avatar_id ?? null,
    roleIds: roles.map((row) => String(row.id)),
    roles: roles.map(
      (row) => ({ id: String(row.id), name: String(row.name) }) satisfies RoleOptionDto,
    ),
    permissions: permissions.map((row) => String(row.code)),
    fullAccess: Boolean(user.is_master) || roles.some((row) => Boolean(row.full_access)),
    isMaster: Boolean(user.is_master),
    revision: user.revision,
  };
}
