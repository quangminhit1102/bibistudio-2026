import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type { Clock } from "../config";
import { sqlDate } from "../auth/repository";
import type { AuthPrincipal } from "../auth/service";
import { lockAuthorizedUsers, withRbacWrite } from "../authorization/transaction";
import { assertPermission } from "../authorization/permissions";
import { writeAudit } from "../audit/repository";
import { ApiError } from "../http/errors";
import { assertVisitorControlsReady } from "./controls-schema";
import { normalizeExclusionRules } from "./exclusions";
import { withVisitorWriteRetry } from "./write-retry";
import { z } from "zod";
import { validate } from "../http/validation";
export async function readExclusions(
  c: Pool | PoolConnection,
  lock = false,
): Promise<{ revision: number; rules: string[] }> {
  await assertVisitorControlsReady(c);
  try {
    const [[row]] = await c.query<RowDataPacket[]>(
      `SELECT revision,rules FROM visitor_exclusion_settings WHERE id=1${lock ? " FOR UPDATE" : ""}`,
    );
    if (!row)
      throw new ApiError(503, "VISITOR_CONTROLS_NOT_READY", "Dịch vụ phân tích chưa sẵn sàng");
    const rules = typeof row.rules === "string" ? JSON.parse(row.rules) : row.rules;
    return { revision: Number(row.revision), rules: normalizeExclusionRules(rules) };
  } catch {
    throw new ApiError(503, "VISITOR_CONTROLS_NOT_READY", "Dịch vụ phân tích chưa sẵn sàng");
  }
}
const uuid = z.string().uuid();
export function createVisitorControlsService(pool: Pool, clock: Clock) {
  async function authorized<T>(
    actor: AuthPrincipal,
    code: string,
    work: (c: PoolConnection) => Promise<T>,
  ) {
    return withVisitorWriteRetry(() =>
      withRbacWrite(pool, async (c) => {
        const { principal } = await lockAuthorizedUsers(c, actor, code, clock);
        assertPermission(principal, "customer_access.view");
        await assertVisitorControlsReady(c);
        return work(c);
      }),
    );
  }
  async function remove(ids: string[], sessionId: string | undefined, actor: AuthPrincipal) {
    validate(
      z
        .array(uuid)
        .min(1)
        .max(100)
        .refine((v) => new Set(v).size === v.length),
      ids,
    );
    if (sessionId) validate(uuid, sessionId);
    return authorized(actor, "customer_access.delete", async (c) => {
      for (const id of [...ids].sort()) {
        const [[v]] = await c.execute<RowDataPacket[]>(
          "SELECT id,is_probe FROM visitors WHERE id=? FOR UPDATE",
          [id],
        );
        if (!v) throw new ApiError(404, "NOT_FOUND", "Dữ liệu đã thay đổi, vui lòng làm mới");
        const [[probe]] = await c.execute<RowDataPacket[]>(
          "SELECT COUNT(*) n FROM release_probes WHERE visitor_id=?",
          [id],
        );
        if (v.is_probe || probe.n)
          throw new ApiError(409, "PROBE_PROTECTED", "Không thể xóa dữ liệu kiểm chứng phát hành");
      }
      let sessionCount = 0,
        visitorCount = 0;
      for (const id of [...ids].sort()) {
        const [sessions] = await c.execute<RowDataPacket[]>(
          `SELECT id FROM visitor_sessions WHERE visitor_id=?${sessionId ? " AND id=?" : ""} FOR UPDATE`,
          sessionId ? [id, sessionId] : [id],
        );
        if (sessionId && !sessions.length)
          throw new ApiError(404, "NOT_FOUND", "Không tìm thấy phiên");
        const scope = sessionId ? [id, sessionId] : [id];
        const sessionFilter = sessionId ? " AND s.id=?" : "";
        for (const table of ["visitor_session_pages", "visitor_viewed_products"])
          await c.execute(
            `DELETE a FROM ${table} a JOIN visitor_sessions s ON s.id=a.session_id WHERE s.visitor_id=?${sessionFilter}`,
            scope,
          );
        await c.execute(
          `DELETE s FROM visitor_sessions s WHERE s.visitor_id=?${sessionFilter}`,
          scope,
        );
        sessionCount += sessions.length;
        const [remaining] = await c.execute<RowDataPacket[]>(
          "SELECT started_at,last_received_at FROM visitor_sessions WHERE visitor_id=? FOR UPDATE",
          [id],
        );
        if (!remaining.length) {
          await c.execute("DELETE FROM visitors WHERE id=?", [id]);
          visitorCount++;
        } else
          await c.execute(
            "UPDATE visitors SET session_count=?,first_seen_at=?,last_seen_at=? WHERE id=?",
            [
              remaining.length,
              new Date(
                remaining.reduce((min, s) => Math.min(min, +sqlDate(s.started_at)), Infinity),
              ),
              new Date(
                remaining.reduce(
                  (max, s) => Math.max(max, +sqlDate(s.last_received_at)),
                  -Infinity,
                ),
              ),
              id,
            ],
          );
      }
      await writeAudit(c, {
        actorId: actor.principal.id,
        action: sessionId ? "customer_access.delete_session" : "customer_access.delete",
        targetType: sessionId ? "visitor_session" : "visitor",
        targetId: sessionId ?? (ids.length === 1 ? ids[0] : undefined),
        metadata: { visitorIds: ids, visitorCount, sessionCount },
      });
      return {
        deletedVisitors: visitorCount,
        deletedSessions: sessionCount,
        visitorDeleted: visitorCount === 1,
      };
    });
  }
  return {
    getExclusions: (actor: AuthPrincipal) =>
      authorized(actor, "customer_access.manage_exclusions", (c) => readExclusions(c)),
    setExclusions: (input: { revision: number; rules: string[] }, actor: AuthPrincipal) => {
      validate(
        z
          .object({
            revision: z.number().int().positive(),
            rules: z.array(z.string().max(100)).max(200),
          })
          .strict(),
        input,
      );
      const rules = normalizeExclusionRules(input.rules);
      return authorized(actor, "customer_access.manage_exclusions", async (c) => {
        const previous = await readExclusions(c, true);
        if (previous.revision !== input.revision)
          throw new ApiError(409, "REVISION_CONFLICT", "Cấu hình đã thay đổi, vui lòng tải lại");
        await c.execute(
          "UPDATE visitor_exclusion_settings SET rules=?,revision=revision+1 WHERE id=1",
          [JSON.stringify(rules)],
        );
        await writeAudit(c, {
          actorId: actor.principal.id,
          action: "customer_access.manage_exclusions",
          targetType: "visitor_exclusions",
          targetId: "1",
          metadata: {
            ruleCount: rules.length,
            addedCount: rules.filter((r) => !previous.rules.includes(r)).length,
            removedCount: previous.rules.filter((r) => !rules.includes(r)).length,
          },
        });
        return { revision: previous.revision + 1, rules };
      });
    },
    deleteVisitors: (ids: string[], actor: AuthPrincipal) => remove(ids, undefined, actor),
    deleteSession: (id: string, sessionId: string, actor: AuthPrincipal) =>
      remove([id], sessionId, actor),
  };
}
