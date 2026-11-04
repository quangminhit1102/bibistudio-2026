import { Router } from "express";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { z } from "zod";
import type { AuthService } from "../auth/service";
import type { AuditDto } from "../http/contracts";
import { authenticate, requirePermission } from "../authorization/middleware";
import { validate } from "../http/validation";
import { sqlDate } from "../auth/repository";
export function auditRoutes(pool: Pool, auth: AuthService): Router {
  const router = Router();
  router.use(authenticate(auth), requirePermission("audit.view"));
  router.get("/", async (req, res) => {
    const query = validate(
      z
        .object({
          page: z.coerce.number().int().min(1).max(100000).default(1),
          pageSize: z.coerce.number().int().min(1).max(100).default(20),
        })
        .strict(),
      req.query,
    );
    const [[count]] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) n FROM audit_logs");
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id,actor_id,action,target_type,target_id,metadata,created_at FROM audit_logs ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?",
      [query.pageSize, (query.page - 1) * query.pageSize],
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
    res.json({ items, total: Number(count.n), page: query.page, pageSize: query.pageSize });
  });
  return router;
}
