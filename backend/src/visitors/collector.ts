import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { z } from "zod";
import { consumeRateLimit } from "../auth/throttle";
import { sqlDate } from "../auth/repository";
import { withTransaction } from "../db/transaction";
import { ApiError } from "../http/errors";
import { networkPrefix } from "../http/network";
import { type Catalogue, publicPath } from "./catalogue";
import { createVisitorCookie, deviceLabels, visitorIdentity } from "./normalize";
import type { VerifiedProbe } from "./probe";

const batchSchema = z
  .object({
    paths: z.array(z.string().max(512)).max(50),
    products: z.array(z.string().max(160)).max(50),
    lastPath: z.string().max(512),
  })
  .strict();
export interface CollectorContext {
  cookie?: string;
  ip: string;
  userAgent: string;
  now: Date;
  idSecret: string;
  catalogue: Catalogue;
  doNotTrack?: boolean;
  probe?: VerifiedProbe;
}
export interface CollectResult {
  status: 202 | 204;
  cookie?: { value: string };
}

async function associations(
  connection: PoolConnection,
  sessionId: string,
  values: string[],
  kind: "pages" | "products",
  cap: number,
  count: number,
  now: Date,
) {
  const table = kind === "pages" ? "visitor_session_pages" : "visitor_viewed_products";
  const column = kind === "pages" ? "path" : "product_slug";
  let truncated = false;
  for (const value of values) {
    const [existing] = await connection.execute<RowDataPacket[]>(
      `SELECT 1 FROM ${table} WHERE session_id=? AND ${column}=?`,
      [sessionId, value],
    );
    if (existing.length) {
      await connection.execute(
        `UPDATE ${table} SET last_received_at=GREATEST(last_received_at,?) WHERE session_id=? AND ${column}=?`,
        [now, sessionId, value],
      );
    } else if (count < cap) {
      await connection.execute(
        `INSERT INTO ${table}(session_id,${column},first_received_at,last_received_at) VALUES (?,?,?,?)`,
        [sessionId, value, now, now],
      );
      count++;
    } else truncated = true;
  }
  return { count, truncated };
}

export async function collectVisitor(
  pool: Pool,
  input: unknown,
  context: CollectorContext,
): Promise<CollectResult> {
  const parsed = batchSchema.safeParse(input);
  if (!parsed.success) throw new ApiError(400, "INVALID_INPUT", "Dữ liệu không hợp lệ");
  if (context.doNotTrack) return { status: 204 };
  const paths = [
    ...new Set(
      parsed.data.paths
        .map((path) => publicPath(path, context.catalogue))
        .filter((path): path is string => !!path),
    ),
  ];
  const products = [
    ...new Set(parsed.data.products.filter((slug) => context.catalogue.products.has(slug))),
  ];
  const lastPath = publicPath(parsed.data.lastPath, context.catalogue) ?? paths.at(-1);
  if (!paths.length || !lastPath) return { status: 204 };
  const identity = visitorIdentity(context.cookie, context.idSecret, context.now);
  if (!identity)
    return { status: 202, cookie: { value: createVisitorCookie(context.idSecret, context.now) } };
  const prefix = networkPrefix(context.ip);
  for (const [key, limit] of [
    [`analytics:network:${prefix}`, 120],
    ["analytics:global", 1200],
    [`analytics:visitor:${identity}`, 10],
  ] as const) {
    if (!(await consumeRateLimit(pool, key, { limit, windowMs: 60000 }, context.now)).allowed) {
      throw new ApiError(429, "RATE_LIMITED", "Vui lòng thử lại sau");
    }
  }
  const labels = deviceLabels(context.userAgent);
  await withTransaction(pool, async (connection) => {
    await connection.execute(
      "INSERT INTO visitors(id,identity_hash,ip_prefix,device_type,operating_system,browser,first_seen_at,last_seen_at,is_probe) VALUES (?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE id=id",
      [
        randomUUID(),
        identity,
        prefix,
        labels.device,
        labels.os,
        labels.browser,
        context.now,
        context.now,
        !!context.probe,
      ],
    );
    const [[visitor]] = await connection.execute<RowDataPacket[]>(
      "SELECT id,is_probe FROM visitors WHERE identity_hash=? FOR UPDATE",
      [identity],
    );
    if (!!visitor.is_probe !== !!context.probe)
      throw new ApiError(409, "PROBE_IDENTITY_CONFLICT", "Yêu cầu không hợp lệ");
    if (context.probe) {
      await connection.execute(
        "INSERT INTO release_probes(id,release_id,marker_hash,visitor_id,expires_at) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE id=id",
        [
          randomUUID(),
          context.probe.releaseId,
          context.probe.markerHash,
          visitor.id,
          context.probe.expiresAt,
        ],
      );
      const [[probe]] = await connection.execute<RowDataPacket[]>(
        "SELECT visitor_id FROM release_probes WHERE marker_hash=? FOR UPDATE",
        [context.probe.markerHash],
      );
      if (probe.visitor_id !== visitor.id)
        throw new ApiError(409, "PROBE_IDENTITY_CONFLICT", "Yêu cầu không hợp lệ");
    }
    const [[previous]] = await connection.execute<RowDataPacket[]>(
      "SELECT * FROM visitor_sessions WHERE visitor_id=? ORDER BY last_received_at DESC,id DESC LIMIT 1",
      [visitor.id],
    );
    let sessionId: string;
    let pageCount = 0;
    let productCount = 0;
    if (!previous || +context.now - +sqlDate(previous.last_received_at) > 30 * 60000) {
      sessionId = randomUUID();
      await connection.execute(
        "INSERT INTO visitor_sessions(id,visitor_id,started_at,last_received_at,landing_path,last_received_path) VALUES (?,?,?,?,?,?)",
        [sessionId, visitor.id, context.now, context.now, paths[0], lastPath],
      );
      await connection.execute("UPDATE visitors SET session_count=session_count+1 WHERE id=?", [
        visitor.id,
      ]);
    } else {
      sessionId = previous.id;
      pageCount = previous.page_count;
      productCount = previous.product_count;
    }
    const pages = await associations(
      connection,
      sessionId,
      paths,
      "pages",
      200,
      pageCount,
      context.now,
    );
    const interests = await associations(
      connection,
      sessionId,
      products,
      "products",
      100,
      productCount,
      context.now,
    );
    await connection.execute(
      "UPDATE visitor_sessions SET last_received_path=IF(last_received_at<=?, ?, last_received_path),last_received_at=GREATEST(last_received_at,?),page_count=?,product_count=?,truncated=truncated OR ? WHERE id=?",
      [
        context.now,
        lastPath,
        context.now,
        pages.count,
        interests.count,
        pages.truncated || interests.truncated,
        sessionId,
      ],
    );
    await connection.execute(
      "UPDATE visitors SET last_seen_at=GREATEST(last_seen_at,?) WHERE id=?",
      [context.now, visitor.id],
    );
  });
  return { status: 204 };
}
