import type { Pool, RowDataPacket } from "mysql2/promise";
import type { VisitorSessionDto } from "../http/contracts";
import { sqlDate } from "../auth/repository";
import type { Catalogue } from "./catalogue";
import { ApiError } from "../http/errors";
import { visitorContextDto } from "./context-dto";
export const visitorIso = (value: string) => sqlDate(value).toISOString();
export function readHistoryCursor(value: string | undefined, fingerprint: string) {
  if (value === undefined) return null;
  try {
    if (!/^[\w-]{1,600}$/.test(value)) throw new Error();
    const cursor = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (
      cursor.fingerprint !== fingerprint ||
      typeof cursor.id !== "string" ||
      cursor.id.length > 36 ||
      typeof cursor.time !== "string" ||
      new Date(cursor.time).toISOString() !== cursor.time
    )
      throw new Error();
    return { id: cursor.id as string, time: cursor.time as string };
  } catch {
    throw new ApiError(
      400,
      "INVALID_VISITOR_CURSOR",
      "Danh sách phiên đã thay đổi, vui lòng tải lại",
    );
  }
}
export async function sessionDtos(
  pool: Pool,
  catalogue: Catalogue,
  rows: RowDataPacket[],
): Promise<VisitorSessionDto[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [pages] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM visitor_session_pages WHERE session_id IN (?) ORDER BY first_received_at,path",
    [ids],
  );
  const [products] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM visitor_viewed_products WHERE session_id IN (?) ORDER BY first_received_at,product_slug",
    [ids],
  );
  return rows.map((row) => ({
    id: row.id,
    visitorId: row.visitor_id,
    startedAt: visitorIso(row.started_at),
    lastReceivedAt: visitorIso(row.last_received_at),
    ...visitorContextDto(row),
    deviceType: row.selected_device,
    operatingSystem: row.selected_os,
    browser: row.selected_browser,
    landingPath: row.landing_path,
    lastReceivedPath: row.last_received_path,
    distinctPageCount: Number(row.page_count),
    truncated: !!row.truncated,
    pages: pages
      .filter((p) => p.session_id === row.id)
      .slice(0, 200)
      .map((p) => ({
        path: p.path,
        firstReceivedAt: visitorIso(p.first_received_at),
        lastReceivedAt: visitorIso(p.last_received_at),
      })),
    products: products
      .filter((p) => p.session_id === row.id)
      .slice(0, 100)
      .map((p) => ({
        slug: p.product_slug,
        name: catalogue.products.get(p.product_slug) ?? p.product_slug,
        firstReceivedAt: visitorIso(p.first_received_at),
        lastReceivedAt: visitorIso(p.last_received_at),
      })),
  }));
}
