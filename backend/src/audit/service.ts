import type { Pool, RowDataPacket } from "mysql2/promise";
import type { Clock } from "../config";
import type { AuthPrincipal } from "../auth/service";
import type { AuditDto, Page } from "../http/contracts";
import { sqlDate } from "../auth/repository";
import { withTransaction } from "../db/transaction";
import { lockAuthorizedUsers } from "../authorization/transaction";
export function listAudit(
  pool: Pool,
  clock: Clock,
  query: { page: number; pageSize: number; search: string },
  actor: AuthPrincipal,
): Promise<Page<AuditDto>> {
  return withTransaction(pool, async (connection) => {
    await lockAuthorizedUsers(connection, actor, "audit.view", clock);
    const term = `%${query.search.replace(/[=%_]/g, (value) => "=" + value)}%`;
    const where =
      "action LIKE ? ESCAPE '=' OR target_id LIKE ? ESCAPE '=' OR actor_id LIKE ? ESCAPE '='";
    const params = [term, term, term];
    const [[count]] = await connection.execute<RowDataPacket[]>(
      `SELECT COUNT(*) n FROM audit_logs WHERE ${where}`,
      params,
    );
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT id,actor_id,action,target_type,target_id,metadata,created_at FROM audit_logs WHERE ${where} ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?`,
      [...params, query.pageSize, (query.page - 1) * query.pageSize],
    );
    const items: AuditDto[] = rows.map((row) => ({
      id: String(row.id),
      actorId: row.actor_id,
      action: row.action,
      targetType: row.target_type,
      targetId: row.target_id,
      metadata: typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata,
      createdAt: sqlDate(row.created_at).toISOString(),
    }));
    return { items, total: Number(count.n), page: query.page, pageSize: query.pageSize };
  });
}
