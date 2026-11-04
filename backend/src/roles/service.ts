import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type { Clock } from "../config";
import type { AuthPrincipal } from "../auth/service";
import type { PermissionDto, PrincipalDto, RoleDto, RoleOptionDto } from "../http/contracts";
import { ApiError } from "../http/errors";
import { withTransaction } from "../db/transaction";
import { assertPermission } from "../authorization/permissions";
import { lockAuthorizedUsers, withRbacWrite } from "../authorization/transaction";
import { writeAudit } from "../audit/repository";
import { roleDto } from "./repository";

export function createRoleService({ pool, clock }: { pool: Pool; clock: Clock }) {
  async function read(connection: PoolConnection, id: string): Promise<RoleDto> {
    const [[row]] = await connection.execute<RowDataPacket[]>("SELECT * FROM roles WHERE id=?", [
      id,
    ]);
    return roleDto(connection, row);
  }
  async function validatePermissions(
    connection: PoolConnection,
    principal: PrincipalDto,
    ids: string[],
  ): Promise<void> {
    assertPermission(principal, "role.assign_permission");
    for (const id of ids) {
      const [[row]] = await connection.execute<RowDataPacket[]>(
        "SELECT code FROM permissions WHERE id=?",
        [id],
      );
      if (!row) throw new ApiError(400, "UNKNOWN_PERMISSION", "Quyền không hợp lệ");
      if (!principal.fullAccess && !principal.permissions.includes(String(row.code)))
        throw new ApiError(
          403,
          "GRANT_EXCEEDS_AUTHORITY",
          "Không thể cấp quyền cao hơn quyền hiện có",
        );
    }
  }
  async function mutation<T>(
    id: string,
    revision: number,
    actor: AuthPrincipal,
    code: string,
    work: (
      connection: PoolConnection,
      principal: PrincipalDto,
      role: RowDataPacket,
      affectedIds: string[],
    ) => Promise<T>,
  ): Promise<T> {
    return withRbacWrite(pool, async (connection) => {
      // Membership cannot change while the shared RBAC writer lock is held.
      const [members] = await connection.execute<RowDataPacket[]>(
        "SELECT user_id FROM user_roles WHERE role_id=? ORDER BY user_id",
        [id],
      );
      const affectedIds = members.map((row) => String(row.user_id));
      const { principal } = await lockAuthorizedUsers(connection, actor, code, clock, affectedIds);
      const [[role]] = await connection.execute<RowDataPacket[]>(
        "SELECT * FROM roles WHERE id=? FOR UPDATE",
        [id],
      );
      if (!role) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy vai trò");
      if (role.full_access || role.id === "system-admin")
        throw new ApiError(403, "PROTECTED_ROLE", "Không thể thay đổi vai trò quản trị");
      if (role.revision !== revision)
        throw new ApiError(409, "REVISION_CONFLICT", "Dữ liệu đã thay đổi. Vui lòng tải lại");
      return work(connection, principal, role, affectedIds);
    });
  }
  async function duplicateSafe<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ER_DUP_ENTRY"
      )
        throw new ApiError(409, "ROLE_EXISTS", "Tên vai trò đã được sử dụng");
      throw error;
    }
  }
  return {
    list: (actor: AuthPrincipal): Promise<RoleDto[]> =>
      withTransaction(pool, async (connection) => {
        await lockAuthorizedUsers(connection, actor, "role.view", clock);
        const [rows] = await connection.query<RowDataPacket[]>(
          "SELECT * FROM roles ORDER BY name,id",
        );
        const result: RoleDto[] = [];
        for (const row of rows) result.push(await roleDto(connection, row));
        return result;
      }),
    listAssignableRoles: (actor: AuthPrincipal): Promise<RoleOptionDto[]> =>
      withTransaction(pool, async (connection) => {
        const { principal } = await lockAuthorizedUsers(
          connection,
          actor,
          "account.assign_role",
          clock,
        );
        const [rows] = await connection.query<RowDataPacket[]>(
          "SELECT * FROM roles ORDER BY name,id",
        );
        const result: RoleOptionDto[] = [];
        for (const row of rows) {
          const role = await roleDto(connection, row);
          if (
            principal.fullAccess ||
            (!role.fullAccess &&
              role.permissionIds.every((code) => principal.permissions.includes(code)))
          )
            result.push({ id: role.id, name: role.name });
        }
        return result;
      }),
    listPermissions: (actor: AuthPrincipal): Promise<PermissionDto[]> =>
      withTransaction(pool, async (connection) => {
        await lockAuthorizedUsers(connection, actor, "permission.view", clock);
        const [rows] = await connection.query<RowDataPacket[]>(
          "SELECT id,code,description FROM permissions ORDER BY code",
        );
        return rows.map((row) => ({
          id: String(row.id),
          code: String(row.code),
          description: String(row.description),
        }));
      }),
    create: (
      input: { name: string; description: string; permissionIds: string[] },
      actor: AuthPrincipal,
    ): Promise<RoleDto> =>
      duplicateSafe(() =>
        withRbacWrite(pool, async (connection) => {
          const { principal } = await lockAuthorizedUsers(connection, actor, "role.create", clock);
          if (input.permissionIds.length)
            await validatePermissions(connection, principal, input.permissionIds);
          const id = randomUUID();
          await connection.execute("INSERT INTO roles(id,name,description) VALUES (?,?,?)", [
            id,
            input.name,
            input.description,
          ]);
          for (const permission of input.permissionIds)
            await connection.execute(
              "INSERT INTO role_permissions(role_id,permission_id) VALUES (?,?)",
              [id, permission],
            );
          await writeAudit(connection, {
            actorId: principal.id,
            action: "role.create",
            targetType: "role",
            targetId: id,
          });
          return read(connection, id);
        }),
      ),
    update: (
      id: string,
      input: { name?: string; description?: string },
      revision: number,
      actor: AuthPrincipal,
    ): Promise<RoleDto> =>
      duplicateSafe(() =>
        mutation(id, revision, actor, "role.update", async (connection, principal, role) => {
          await connection.execute(
            "UPDATE roles SET name=?,description=?,revision=revision+1 WHERE id=?",
            [input.name ?? role.name, input.description ?? role.description, id],
          );
          await writeAudit(connection, {
            actorId: principal.id,
            action: "role.update",
            targetType: "role",
            targetId: id,
          });
          return read(connection, id);
        }),
      ),
    setPermissions: (
      id: string,
      permissionIds: string[],
      revision: number,
      actor: AuthPrincipal,
    ): Promise<RoleDto> =>
      mutation(
        id,
        revision,
        actor,
        "role.assign_permission",
        async (connection, principal, _role, affectedIds) => {
          if (!principal.fullAccess && affectedIds.includes(principal.id))
            throw new ApiError(
              403,
              "SELF_PERMISSION_CHANGE",
              "Không thể tự thay đổi quyền của vai trò đang dùng",
            );
          await validatePermissions(connection, principal, permissionIds);
          await connection.execute("DELETE FROM role_permissions WHERE role_id=?", [id]);
          for (const permission of permissionIds)
            await connection.execute(
              "INSERT INTO role_permissions(role_id,permission_id) VALUES (?,?)",
              [id, permission],
            );
          await connection.execute("UPDATE roles SET revision=revision+1 WHERE id=?", [id]);
          for (const userId of affectedIds) {
            await connection.execute("UPDATE users SET auth_version=auth_version+1 WHERE id=?", [
              userId,
            ]);
            await connection.execute(
              "UPDATE refresh_token_sessions SET revoked_at=?,revoke_reason='permissions_changed' WHERE user_id=? AND revoked_at IS NULL",
              [clock.now(), userId],
            );
          }
          await writeAudit(connection, {
            actorId: principal.id,
            action: "role.assign_permission",
            targetType: "role",
            targetId: id,
            metadata: { permissionIds },
          });
          return read(connection, id);
        },
      ),
    remove: (id: string, revision: number, actor: AuthPrincipal): Promise<void> =>
      mutation(
        id,
        revision,
        actor,
        "role.delete",
        async (connection, principal, role, affectedIds) => {
          if (role.is_system)
            throw new ApiError(403, "PROTECTED_ROLE", "Không thể xóa vai trò hệ thống");
          if (affectedIds.length)
            throw new ApiError(409, "ROLE_IN_USE", "Vai trò đang được sử dụng");
          await connection.execute("DELETE FROM role_permissions WHERE role_id=?", [id]);
          await connection.execute("DELETE FROM roles WHERE id=?", [id]);
          await writeAudit(connection, {
            actorId: principal.id,
            action: "role.delete",
            targetType: "role",
            targetId: id,
          });
        },
      ),
  };
}
export type RoleService = ReturnType<typeof createRoleService>;
