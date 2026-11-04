import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type { Clock } from "../config";
import type { AccountDto, Page, PrincipalDto } from "../http/contracts";
import type { AuthPrincipal } from "../auth/service";
import { resolvePrincipal, sqlDate, type UserRow } from "../auth/repository";
import { hashPassword } from "../auth/password";
import { ApiError } from "../http/errors";
import { withTransaction } from "../db/transaction";
import { assertPermission } from "../authorization/permissions";
import { writeAudit } from "../audit/repository";
import { accountDto } from "./repository";

interface AccountInput {
  username: string;
  displayName: string;
  email?: string | null;
  password: string;
  roleIds: string[];
}
interface AccountUpdate {
  username?: string;
  displayName?: string;
  email?: string | null;
  password?: string;
}
const denied = (): ApiError =>
  new ApiError(403, "PROTECTED_ACCOUNT", "Không thể thay đổi tài khoản quản trị chính");

export function createAccountService({ pool, clock }: { pool: Pool; clock: Clock }) {
  async function authorized<T>(
    actor: AuthPrincipal,
    code: string,
    targetId: string | undefined,
    work: (connection: PoolConnection, principal: PrincipalDto, target?: UserRow) => Promise<T>,
  ): Promise<T> {
    return withTransaction(pool, async (connection) => {
      const locked = new Map<string, UserRow>();
      for (const id of [...new Set([actor.principal.id, ...(targetId ? [targetId] : [])])].sort()) {
        const [rows] = await connection.execute<UserRow[]>(
          "SELECT * FROM users WHERE id=? FOR UPDATE",
          [id],
        );
        if (rows[0]) locked.set(id, rows[0]);
      }
      const current = locked.get(actor.principal.id);
      if (
        !current ||
        !current.active ||
        current.deleted_at ||
        current.auth_version !== actor.authVersion
      )
        throw new ApiError(401, "UNAUTHENTICATED", "Vui lòng đăng nhập lại");
      const [[session]] = await connection.execute<RowDataPacket[]>(
        "SELECT * FROM refresh_token_sessions WHERE id=? AND user_id=? FOR UPDATE",
        [actor.sid, current.id],
      );
      if (
        !session ||
        session.revoked_at ||
        session.auth_version !== current.auth_version ||
        +sqlDate(session.idle_expires_at) <= +clock.now() ||
        +sqlDate(session.absolute_expires_at) <= +clock.now()
      )
        throw new ApiError(401, "UNAUTHENTICATED", "Vui lòng đăng nhập lại");
      const principal = await resolvePrincipal(connection, current);
      assertPermission(principal, code);
      const target = targetId ? locked.get(targetId) : undefined;
      if (targetId && (!target || target.deleted_at))
        throw new ApiError(404, "NOT_FOUND", "Không tìm thấy tài khoản");
      return work(connection, principal, target);
    });
  }
  async function checkRoles(
    connection: PoolConnection,
    principal: PrincipalDto,
    ids: string[],
  ): Promise<void> {
    assertPermission(principal, "account.assign_role");
    for (const id of [...ids].sort()) {
      const [[role]] = await connection.execute<RowDataPacket[]>(
        "SELECT * FROM roles WHERE id=? FOR UPDATE",
        [id],
      );
      if (!role) throw new ApiError(400, "UNKNOWN_ROLE", "Vai trò không hợp lệ");
      if (!principal.fullAccess) {
        if (role.full_access)
          throw new ApiError(
            403,
            "GRANT_EXCEEDS_AUTHORITY",
            "Không thể cấp quyền cao hơn quyền hiện có",
          );
        const [permissions] = await connection.execute<RowDataPacket[]>(
          "SELECT permission_id FROM role_permissions WHERE role_id=?",
          [id],
        );
        if (permissions.some((row) => !principal.permissions.includes(String(row.permission_id))))
          throw new ApiError(
            403,
            "GRANT_EXCEEDS_AUTHORITY",
            "Không thể cấp quyền cao hơn quyền hiện có",
          );
      }
    }
  }
  function mutable(target: UserRow, revision: number): void {
    if (target.is_master) throw denied();
    if (target.revision !== revision)
      throw new ApiError(409, "REVISION_CONFLICT", "Dữ liệu đã thay đổi. Vui lòng tải lại");
  }
  async function revoke(
    connection: PoolConnection,
    target: UserRow,
    reason: string,
  ): Promise<void> {
    await connection.execute("UPDATE users SET auth_version=auth_version+1 WHERE id=?", [
      target.id,
    ]);
    await connection.execute(
      "UPDATE refresh_token_sessions SET revoked_at=?,revoke_reason=? WHERE user_id=? AND revoked_at IS NULL",
      [clock.now(), reason, target.id],
    );
  }
  async function read(connection: PoolConnection, id: string): Promise<AccountDto> {
    const [[row]] = await connection.execute<UserRow[]>("SELECT * FROM users WHERE id=?", [id]);
    return accountDto(connection, row);
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
        throw new ApiError(409, "USERNAME_EXISTS", "Tên tài khoản đã được sử dụng");
      throw error;
    }
  }
  return {
    list: (
      query: { search: string; page: number; pageSize: number },
      actor: AuthPrincipal,
    ): Promise<Page<AccountDto>> =>
      authorized(actor, "account.view", undefined, async (connection) => {
        const term = `%${query.search.replace(/[=%_]/g, (character) => "=" + character)}%`;
        const predicate =
          "deleted_at IS NULL AND (username LIKE ? ESCAPE '=' OR display_name LIKE ? ESCAPE '=')";
        const [[count]] = await connection.execute<RowDataPacket[]>(
          `SELECT COUNT(*) n FROM users WHERE ${predicate}`,
          [term, term],
        );
        const [rows] = await connection.query<UserRow[]>(
          `SELECT * FROM users WHERE ${predicate} ORDER BY created_at DESC,id LIMIT ? OFFSET ?`,
          [term, term, query.pageSize, (query.page - 1) * query.pageSize],
        );
        const items: AccountDto[] = [];
        for (const row of rows) items.push(await accountDto(connection, row));
        return { items, total: Number(count.n), page: query.page, pageSize: query.pageSize };
      }),
    get: (id: string, actor: AuthPrincipal): Promise<AccountDto> =>
      authorized(actor, "account.view", id, async (connection) => read(connection, id)),
    create: (input: AccountInput, actor: AuthPrincipal): Promise<AccountDto> =>
      duplicateSafe(() =>
        authorized(actor, "account.create", undefined, async (connection, principal) => {
          if (input.roleIds.length) await checkRoles(connection, principal, input.roleIds);
          const id = randomUUID();
          const hash = await hashPassword(input.password);
          await connection.execute(
            "INSERT INTO users(id,username,display_name,email,password_hash) VALUES (?,?,?,?,?)",
            [id, input.username.trim().toLowerCase(), input.displayName, input.email ?? null, hash],
          );
          for (const roleId of input.roleIds)
            await connection.execute("INSERT INTO user_roles(user_id,role_id) VALUES (?,?)", [
              id,
              roleId,
            ]);
          await writeAudit(connection, {
            actorId: principal.id,
            action: "account.create",
            targetType: "account",
            targetId: id,
          });
          return read(connection, id);
        }),
      ),
    update: (
      id: string,
      input: AccountUpdate,
      revision: number,
      actor: AuthPrincipal,
    ): Promise<AccountDto> =>
      duplicateSafe(() =>
        authorized(actor, "account.update", id, async (connection, principal, target) => {
          mutable(target!, revision);
          const columns: string[] = [];
          const values: (string | null)[] = [];
          for (const [key, column] of [
            ["username", "username"],
            ["displayName", "display_name"],
            ["email", "email"],
          ] as const) {
            const value = input[key];
            if (value !== undefined) {
              columns.push(`${column}=?`);
              values.push(key === "username" ? String(value).trim().toLowerCase() : value);
            }
          }
          if (input.password !== undefined) {
            columns.push("password_hash=?");
            values.push(await hashPassword(input.password));
          }
          await connection.execute(
            `UPDATE users SET ${columns.length ? columns.join(",") + "," : ""}revision=revision+1,updated_at=? WHERE id=?`,
            [...values, clock.now(), id],
          );
          if (input.password !== undefined) await revoke(connection, target!, "password_changed");
          await writeAudit(connection, {
            actorId: principal.id,
            action: "account.update",
            targetType: "account",
            targetId: id,
            metadata: { changedFields: Object.keys(input) },
          });
          return read(connection, id);
        }),
      ),
    setActive: (
      id: string,
      active: boolean,
      revision: number,
      actor: AuthPrincipal,
    ): Promise<AccountDto> =>
      authorized(
        actor,
        active ? "account.activate" : "account.deactivate",
        id,
        async (connection, principal, target) => {
          mutable(target!, revision);
          await connection.execute(
            "UPDATE users SET active=?,revision=revision+1,updated_at=? WHERE id=?",
            [active, clock.now(), id],
          );
          if (!active) await revoke(connection, target!, "deactivated");
          await writeAudit(connection, {
            actorId: principal.id,
            action: active ? "account.activate" : "account.deactivate",
            targetType: "account",
            targetId: id,
          });
          return read(connection, id);
        },
      ),
    setRoles: (
      id: string,
      roleIds: string[],
      revision: number,
      actor: AuthPrincipal,
    ): Promise<AccountDto> =>
      authorized(actor, "account.assign_role", id, async (connection, principal, target) => {
        mutable(target!, revision);
        if (id === principal.id)
          throw new ApiError(403, "SELF_ROLE_CHANGE", "Không thể tự thay đổi vai trò");
        await checkRoles(connection, principal, roleIds);
        await connection.execute("DELETE FROM user_roles WHERE user_id=?", [id]);
        for (const roleId of roleIds)
          await connection.execute("INSERT INTO user_roles(user_id,role_id) VALUES (?,?)", [
            id,
            roleId,
          ]);
        await connection.execute("UPDATE users SET revision=revision+1,updated_at=? WHERE id=?", [
          clock.now(),
          id,
        ]);
        await revoke(connection, target!, "roles_changed");
        await writeAudit(connection, {
          actorId: principal.id,
          action: "account.assign_role",
          targetType: "account",
          targetId: id,
          metadata: { roleIds },
        });
        return read(connection, id);
      }),
    remove: (id: string, revision: number, actor: AuthPrincipal): Promise<void> =>
      authorized(actor, "account.delete", id, async (connection, principal, target) => {
        mutable(target!, revision);
        await connection.execute(
          "UPDATE users SET active=0,deleted_at=?,updated_at=?,revision=revision+1 WHERE id=?",
          [clock.now(), clock.now(), id],
        );
        await revoke(connection, target!, "deleted");
        await writeAudit(connection, {
          actorId: principal.id,
          action: "account.delete",
          targetType: "account",
          targetId: id,
        });
      }),
  };
}
export type AccountService = ReturnType<typeof createAccountService>;
