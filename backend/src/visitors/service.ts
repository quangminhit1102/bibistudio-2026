import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type { Clock } from "../config";
import type {
  Page,
  VisitorDto,
  VisitorSessionDto,
  VisitorReportDto,
  VisitorWindowDto,
  VisitorProductPageDto,
  VisitorSessionHistoryDto,
} from "../http/contracts";
import { ApiError } from "../http/errors";
import type { Catalogue } from "./catalogue";
import { visitorCohort, visitorScopeFingerprint, type VisitorScope } from "./report-query";
import { visitorBuckets, selectVisitorBucket } from "./date-window";
import { readHistoryCursor, sessionDtos, visitorIso } from "./session-history";

/** One report's aggregates share a nonlocking snapshot while collectors continue writing. */
async function reportSnapshot<T>(
  pool: Pool,
  read: (connection: PoolConnection) => Promise<T>,
): Promise<T> {
  const connection = await pool.getConnection();
  try {
    await connection.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    await connection.query("START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY");
    const result = await read(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
export interface VisitorQuery extends VisitorScope {
  page: number;
  pageSize: number;
  search: string;
  product?: string;
}
export function createVisitorService(pool: Pool, catalogue: Catalogue, clock: Clock) {
  const cohort = (input: VisitorScope = {}) => visitorCohort(input, clock.now());
  const visitorSelect = `, ranked AS (SELECT selected.*,ROW_NUMBER() OVER(PARTITION BY visitor_id ORDER BY last_received_at DESC,id DESC) rn FROM selected), totals AS (SELECT visitor_id,COUNT(*) session_count,MIN(started_at) first_seen_at FROM selected GROUP BY visitor_id), pages AS (SELECT s.visitor_id,COUNT(DISTINCT p.path) distinct_page_count FROM selected s JOIN visitor_session_pages p ON p.session_id=s.id GROUP BY s.visitor_id)
    SELECT r.*,t.session_count,t.first_seen_at,COALESCE(p.distinct_page_count,0) distinct_page_count FROM ranked r JOIN totals t ON t.visitor_id=r.visitor_id LEFT JOIN pages p ON p.visitor_id=r.visitor_id WHERE r.rn=1`;
  const dto = (row: RowDataPacket): VisitorDto => ({
    id: row.visitor_id,
    anonymousId: `KH-${row.visitor_id.slice(0, 8)}`,
    ipAddress: row.ip_status === "verified" ? (row.client_ip ?? "") : "",
    ipStatus: row.ip_status ?? "legacy",
    country: row.country,
    city: row.city,
    deviceType: row.selected_device,
    operatingSystem: row.selected_os,
    browser: row.selected_browser,
    firstSeenAt: visitorIso(row.first_seen_at),
    lastSeenAt: visitorIso(row.last_received_at),
    sessionCount: Number(row.session_count),
    distinctPageCount: Number(row.distinct_page_count),
  });
  async function assertVisitor(id: string) {
    const [[row]] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM visitors WHERE id=? AND is_probe=0",
      [id],
    );
    if (!row) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy khách truy cập");
    return row;
  }
  async function get(
    id: string,
    input: VisitorScope = {},
  ): Promise<VisitorDto & { window: VisitorWindowDto }> {
    const known = await assertVisitor(id),
      c = cohort(input);
    const [[row]] = await pool.query<RowDataPacket[]>(
      `WITH selected AS (${c.sql} AND s.visitor_id=?) ${visitorSelect}`,
      [...c.params, id],
    );
    return {
      ...(row
        ? dto(row)
        : {
            id,
            anonymousId: `KH-${id.slice(0, 8)}`,
            ipAddress: "",
            ipStatus: "unavailable" as const,
            country: known.country,
            city: known.city,
            deviceType: known.device_type,
            operatingSystem: known.operating_system,
            browser: known.browser,
            firstSeenAt: visitorIso(known.first_seen_at),
            lastSeenAt: visitorIso(known.last_seen_at),
            sessionCount: 0,
            distinctPageCount: 0,
          }),
      window: c.window,
    };
  }
  async function list(
    input: VisitorQuery,
  ): Promise<Page<VisitorDto> & { window: VisitorWindowDto }> {
    const c = cohort(input);
    const [[count]] = await pool.query<RowDataPacket[]>(
      `WITH selected AS (${c.sql}) SELECT COUNT(DISTINCT visitor_id) n FROM selected`,
      c.params,
    );
    const [rows] = await pool.query<RowDataPacket[]>(
      `WITH selected AS (${c.sql}) ${visitorSelect} ORDER BY r.last_received_at DESC,r.visitor_id DESC LIMIT ? OFFSET ?`,
      [...c.params, input.pageSize, (input.page - 1) * input.pageSize],
    );
    return {
      items: rows.map(dto),
      total: Number(count.n),
      page: input.page,
      pageSize: input.pageSize,
      window: c.window,
    };
  }
  async function sessionHistory(
    id: string,
    input: VisitorScope & { cursor?: string } = {},
  ): Promise<VisitorSessionHistoryDto> {
    await assertVisitor(id);
    const c = cohort(input),
      fingerprint = visitorScopeFingerprint(id, input, c.window),
      cursor = readHistoryCursor(input.cursor, fingerprint);
    const [rows] = await pool.query<RowDataPacket[]>(
      `WITH selected AS (${c.sql}) SELECT * FROM selected WHERE visitor_id=? ${cursor ? "AND (last_received_at<? OR (last_received_at=? AND id<?))" : ""} ORDER BY last_received_at DESC,id DESC LIMIT 21`,
      [
        ...c.params,
        id,
        ...(cursor ? [new Date(cursor.time), new Date(cursor.time), cursor.id] : []),
      ],
    );
    const selected = rows.slice(0, 20),
      last = selected.at(-1);
    return {
      items: await sessionDtos(pool, catalogue, selected),
      nextCursor:
        rows.length > 20 && last
          ? Buffer.from(
              JSON.stringify({ fingerprint, time: visitorIso(last.last_received_at), id: last.id }),
            ).toString("base64url")
          : null,
      window: c.window,
    };
  }
  async function sessions(
    id: string,
    input: { page: number; pageSize: number } & VisitorScope,
  ): Promise<Page<VisitorSessionDto>> {
    await assertVisitor(id);
    const c = cohort(input);
    const [[total]] = await pool.query<RowDataPacket[]>(
      `WITH selected AS (${c.sql}) SELECT COUNT(*) n FROM selected WHERE visitor_id=?`,
      [...c.params, id],
    );
    const [rows] = await pool.query<RowDataPacket[]>(
      `WITH selected AS (${c.sql}) SELECT * FROM selected WHERE visitor_id=? ORDER BY last_received_at DESC,id DESC LIMIT ? OFFSET ?`,
      [...c.params, id, input.pageSize, (input.page - 1) * input.pageSize],
    );
    return {
      items: await sessionDtos(pool, catalogue, rows),
      total: Number(total.n),
      page: input.page,
      pageSize: input.pageSize,
    };
  }
  async function productReport(
    input: VisitorScope & { page: number; pageSize: number },
    reader: Pool | PoolConnection = pool,
  ): Promise<VisitorProductPageDto> {
    const c = cohort(input);
    const [[total]] = await reader.query<RowDataPacket[]>(
      `WITH selected AS (${c.sql}) SELECT COUNT(DISTINCT p.product_slug) n FROM selected s JOIN visitor_viewed_products p ON p.session_id=s.id`,
      c.params,
    );
    const [rows] = await reader.query<RowDataPacket[]>(
      `WITH selected AS (${c.sql}) SELECT p.product_slug,COUNT(DISTINCT s.visitor_id) n FROM selected s JOIN visitor_viewed_products p ON p.session_id=s.id GROUP BY p.product_slug ORDER BY n DESC,p.product_slug LIMIT ? OFFSET ?`,
      [...c.params, input.pageSize, (input.page - 1) * input.pageSize],
    );
    return {
      items: rows.map((p) => ({
        slug: p.product_slug,
        name: catalogue.products.get(p.product_slug) ?? p.product_slug,
        interestedVisitors: Number(p.n),
      })),
      total: Number(total.n),
      page: input.page,
      pageSize: input.pageSize,
      window: c.window,
    };
  }
  async function report(input: VisitorScope = {}): Promise<Required<VisitorReportDto>> {
    return reportSnapshot(pool, async (reader) => {
      const c = cohort(input);
      const [[total]] = await reader.query<RowDataPacket[]>(
        `WITH selected AS (${c.sql}) SELECT COUNT(*) sessions,COUNT(DISTINCT visitor_id) visitors,COUNT(DISTINCT CASE WHEN EXISTS(SELECT 1 FROM visitor_viewed_products p WHERE p.session_id=s.id) THEN visitor_id END) interested FROM selected s`,
        c.params,
      );
      const products = await productReport(
        {
          ...input,
          from: c.window.fromDate,
          to: c.window.toDate,
          page: 1,
          pageSize: 10,
        },
        reader,
      );
      const unit = selectVisitorBucket(c.window),
        local = "DATE_ADD(started_at, INTERVAL 7 HOUR)";
      const formats = {
        hour: "%Y-%m-%d %H:00:00",
        day: "%Y-%m-%d 00:00:00",
        week: "%Y-%m-%d 00:00:00",
        month: "%Y-%m-01 00:00:00",
        year: "%Y-01-01 00:00:00",
      };
      const expression =
        unit === "week" ? `DATE_SUB(${local}, INTERVAL WEEKDAY(${local}) DAY)` : local;
      const [counts] = await reader.query<RowDataPacket[]>(
        `WITH selected AS (${c.sql}) SELECT DATE_FORMAT(${expression},'${formats[unit]}') bucket,COUNT(*) n FROM selected GROUP BY bucket`,
        c.params,
      );
      const buckets = visitorBuckets(c.window),
        byStart = new Map(buckets.map((b) => [b.startUtc, b]));
      for (const row of counts) {
        const utc = new Date(
          Math.max(
            Date.parse(c.window.startUtc),
            Date.parse(row.bucket.replace(" ", "T") + "+07:00"),
          ),
        ).toISOString();
        const bucket = byStart.get(utc);
        if (bucket) bucket.sessions = Number(row.n);
      }
      return {
        totalVisitors: Number(total.visitors),
        totalSessions: Number(total.sessions),
        totalInterestedVisitors: Number(total.interested),
        totalProducts: products.total,
        products: products.items,
        window: c.window,
        bucketUnit: unit,
        series: buckets.map(({ startUtc, label, sessions }) => ({ startUtc, label, sessions })),
      };
    });
  }
  async function filterOptions(input: VisitorScope = {}) {
    const c = cohort(input);
    const [rows] = await pool.query<RowDataPacket[]>(
      `WITH selected AS (${c.sql}) SELECT DISTINCT selected_device,selected_os,selected_browser FROM selected LIMIT 100`,
      c.params,
    );
    const unique = (key: string) => [...new Set(rows.map((r) => String(r[key])))].sort();
    return {
      deviceTypes: unique("selected_device"),
      operatingSystems: unique("selected_os"),
      browsers: unique("selected_browser"),
      products: [],
    };
  }
  return { list, get, sessions, sessionHistory, report, productReport, filterOptions };
}
