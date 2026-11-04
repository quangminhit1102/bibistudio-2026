import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import type { RoleDto } from "../http/contracts";
export async function roleDto(connection: PoolConnection, row: RowDataPacket): Promise<RoleDto> {
  const [permissions] = await connection.execute<RowDataPacket[]>(
    "SELECT permission_id FROM role_permissions WHERE role_id=? ORDER BY permission_id",
    [row.id],
  );
  return {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description),
    isSystem: Boolean(row.is_system),
    fullAccess: Boolean(row.full_access),
    revision: Number(row.revision),
    permissionIds: permissions.map((item) => String(item.permission_id)),
  };
}
