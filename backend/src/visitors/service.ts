import type { Pool, RowDataPacket } from "mysql2/promise";
import type { Clock } from "../config";
import type { Page, VisitorDto, VisitorReportDto, VisitorSessionDto } from "../http/contracts";
import { ApiError } from "../http/errors";
import { sqlDate } from "../auth/repository";
import type { Catalogue } from "./catalogue";
import { ANALYTICS_TTL_MS } from "./normalize";

export interface VisitorQuery {
  page: number;
  pageSize: number;
  search: string;
  deviceType?: string;
  browser?: string;
  product?: string;
}
const iso = (value: string) => sqlDate(value).toISOString();
export function createVisitorService(pool: Pool, catalogue: Catalogue, clock: Clock) {
  const cutoff = () => new Date(+clock.now() - ANALYTICS_TTL_MS);
  function where(query: Partial<VisitorQuery> = {}) {
    const clauses = ["v.is_probe=0", "v.last_seen_at>=?"];
    const params: (string | Date)[] = [cutoff()];
    if (query.search) {
      const term = `%${query.search.replace(/[=%_]/g, (value) => "=" + value)}%`;
      clauses.push("(v.id LIKE ? ESCAPE '=' OR v.ip_prefix LIKE ? ESCAPE '=')");
      params.push(term, term);
    }
    if (query.deviceType) {
      clauses.push("v.device_type=?");
      params.push(query.deviceType);
    }
    if (query.browser) {
      clauses.push("v.browser=?");
      params.push(query.browser);
    }
    if (query.product) {
      clauses.push(
        "EXISTS(SELECT 1 FROM visitor_sessions fs JOIN visitor_viewed_products fp ON fp.session_id=fs.id WHERE fs.visitor_id=v.id AND fp.product_slug=? AND fp.last_received_at>=?)",
      );
      params.push(query.product, cutoff());
    }
    return { sql: clauses.join(" AND "), params };
  }
  const visitorSelect = `SELECT v.id,v.ip_prefix,v.country,v.city,v.device_type,v.operating_system,v.browser,v.first_seen_at,v.last_seen_at,
    (SELECT COUNT(*) FROM visitor_sessions s WHERE s.visitor_id=v.id AND s.last_received_at>=?) session_count,
    (SELECT COUNT(DISTINCT p.path) FROM visitor_session_pages p JOIN visitor_sessions s ON s.id=p.session_id WHERE s.visitor_id=v.id AND p.last_received_at>=?) distinct_page_count FROM visitors v`;
  function dto(row: RowDataPacket): VisitorDto {
    return {
      id: row.id,
      anonymousId: `KH-${row.id.slice(0, 8)}`,
      ipAddress: row.ip_prefix,
      country: row.country,
      city: row.city,
      deviceType: row.device_type,
      operatingSystem: row.operating_system,
      browser: row.browser,
      firstSeenAt: iso(row.first_seen_at),
      lastSeenAt: iso(row.last_seen_at),
      sessionCount: Number(row.session_count),
      distinctPageCount: Number(row.distinct_page_count),
    };
  }
  async function get(id: string): Promise<VisitorDto> {
    const condition = where();
    const [[row]] = await pool.execute<RowDataPacket[]>(
      `${visitorSelect} WHERE ${condition.sql} AND v.id=?`,
      [cutoff(), cutoff(), ...condition.params, id],
    );
    if (!row) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy khách truy cập");
    return dto(row);
  }
  async function list(query: VisitorQuery): Promise<Page<VisitorDto>> {
    const condition = where(query);
    const [[total]] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) n FROM visitors v WHERE ${condition.sql}`,
      condition.params,
    );
    const [rows] = await pool.query<RowDataPacket[]>(
      `${visitorSelect} WHERE ${condition.sql} ORDER BY v.last_seen_at DESC,v.id DESC LIMIT ? OFFSET ?`,
      [cutoff(), cutoff(), ...condition.params, query.pageSize, (query.page - 1) * query.pageSize],
    );
    return {
      items: rows.map(dto),
      total: Number(total.n),
      page: query.page,
      pageSize: query.pageSize,
    };
  }
  async function sessions(
    id: string,
    query: { page: number; pageSize: number },
  ): Promise<Page<VisitorSessionDto>> {
    await get(id);
    const [[total]] = await pool.execute<RowDataPacket[]>(
      "SELECT COUNT(*) n FROM visitor_sessions WHERE visitor_id=? AND last_received_at>=?",
      [id, cutoff()],
    );
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM visitor_sessions WHERE visitor_id=? AND last_received_at>=? ORDER BY last_received_at DESC,id DESC LIMIT ? OFFSET ?",
      [id, cutoff(), query.pageSize, (query.page - 1) * query.pageSize],
    );
    const items: VisitorSessionDto[] = [];
    for (const row of rows) {
      const [pages] = await pool.execute<RowDataPacket[]>(
        "SELECT path,first_received_at,last_received_at FROM visitor_session_pages WHERE session_id=? AND last_received_at>=? ORDER BY first_received_at,path LIMIT 200",
        [row.id, cutoff()],
      );
      const [products] = await pool.execute<RowDataPacket[]>(
        "SELECT product_slug,first_received_at,last_received_at FROM visitor_viewed_products WHERE session_id=? AND last_received_at>=? ORDER BY first_received_at,product_slug LIMIT 100",
        [row.id, cutoff()],
      );
      items.push({
        id: row.id,
        visitorId: id,
        startedAt: iso(row.started_at),
        lastReceivedAt: iso(row.last_received_at),
        landingPath: row.landing_path,
        lastReceivedPath: row.last_received_path,
        distinctPageCount: pages.length,
        truncated: !!row.truncated,
        pages: pages.map((page) => ({
          path: page.path,
          firstReceivedAt: iso(page.first_received_at),
          lastReceivedAt: iso(page.last_received_at),
        })),
        products: products.map((product) => ({
          slug: product.product_slug,
          name: catalogue.products.get(product.product_slug) ?? product.product_slug,
          firstReceivedAt: iso(product.first_received_at),
          lastReceivedAt: iso(product.last_received_at),
        })),
      });
    }
    return { items, total: Number(total.n), ...query };
  }
  async function report(): Promise<VisitorReportDto> {
    const condition = where();
    const [[visitors]] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) n FROM visitors v WHERE ${condition.sql}`,
      condition.params,
    );
    const [[sessions]] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) n FROM visitor_sessions s JOIN visitors v ON v.id=s.visitor_id WHERE ${condition.sql} AND s.last_received_at>=?`,
      [...condition.params, cutoff()],
    );
    const [products] = await pool.execute<RowDataPacket[]>(
      `SELECT p.product_slug,COUNT(DISTINCT v.id) n FROM visitor_viewed_products p JOIN visitor_sessions s ON s.id=p.session_id JOIN visitors v ON v.id=s.visitor_id WHERE ${condition.sql} AND p.last_received_at>=? GROUP BY p.product_slug ORDER BY n DESC,p.product_slug LIMIT 100`,
      [...condition.params, cutoff()],
    );
    return {
      totalVisitors: Number(visitors.n),
      totalSessions: Number(sessions.n),
      products: products.map((product) => ({
        slug: product.product_slug,
        name: catalogue.products.get(product.product_slug) ?? product.product_slug,
        interestedVisitors: Number(product.n),
      })),
    };
  }
  async function filterOptions() {
    const condition = where();
    const distinct = async (column: "device_type" | "browser" | "operating_system") => {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT DISTINCT v.${column} value FROM visitors v WHERE ${condition.sql} ORDER BY value LIMIT 100`,
        condition.params,
      );
      return rows.map((row) => String(row.value));
    };
    return {
      deviceTypes: await distinct("device_type"),
      operatingSystems: await distinct("operating_system"),
      browsers: await distinct("browser"),
      products: (await report()).products.map(({ slug, name }) => ({ slug, name })),
    };
  }
  return { list, get, sessions, report, filterOptions };
}
