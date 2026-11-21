import type {
  Page,
  VisitorDto,
  VisitorSessionDto,
  VisitorReportDto,
  VisitorScopeInput,
  VisitorSessionHistoryDto,
  VisitorProductPageDto,
} from "../../../../backend/src/http/contracts";
import type { AdminHttpClient } from "../../../lib/admin-http";
import { resolveVisitorWindow } from "../../../../backend/src/visitors/date-window";

function assertReportScope(report: VisitorReportDto, scope: VisitorScopeInput) {
  const expected = resolveVisitorWindow({ from: scope.from, to: scope.to }, new Date());
  const count = (value: unknown): value is number =>
    Number.isSafeInteger(value) && Number(value) >= 0;
  const window = report?.window;
  if (
    !window ||
    window.fromDate !== scope.from ||
    window.toDate !== scope.to ||
    window.startUtc !== expected.startUtc ||
    window.endUtcExclusive !== expected.endUtcExclusive ||
    !Number.isFinite(Date.parse(window.asOf)) ||
    !count(report.totalSessions) ||
    !count(report.totalVisitors) ||
    !count(report.totalInterestedVisitors) ||
    !count(report.totalProducts) ||
    report.totalVisitors > report.totalSessions ||
    report.totalInterestedVisitors > report.totalVisitors ||
    !["hour", "day", "week", "month", "year"].includes(report.bucketUnit ?? "") ||
    !Array.isArray(report.series) ||
    !report.series.length ||
    report.series.length > 10000 ||
    !report.series.every(
      (point) =>
        point &&
        typeof point.label === "string" &&
        count(point.sessions) &&
        Number.isFinite(Date.parse(point.startUtc)),
    ) ||
    report.series.reduce((sum, point) => sum + point.sessions, 0) !== report.totalSessions ||
    !Array.isArray(report.products) ||
    report.products.length !== Math.min(10, report.totalProducts) ||
    !report.products.every(
      (product) =>
        product &&
        typeof product.slug === "string" &&
        typeof product.name === "string" &&
        count(product.interestedVisitors),
    )
  ) {
    throw new Error("Phiên bản báo cáo không khớp khoảng ngày đã chọn. Vui lòng tải lại trang.");
  }
}
export interface VisitorFilters {
  deviceTypes: string[];
  operatingSystems: string[];
  browsers: string[];
  products: { slug: string; name: string }[];
}
export function createVisitorApi(http: AdminHttpClient) {
  const root = "/api/customer-access";
  const scopeParams = (scope?: VisitorScopeInput) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(scope ?? {})) if (value) params.set(key, value);
    return params;
  };
  return {
    exclusions: (signal?: AbortSignal) =>
      http.request<{ revision: number; rules: string[] }>(`${root}/exclusions`, { signal }),
    saveExclusions: (input: { revision: number; rules: string[] }) =>
      http.request<{ revision: number; rules: string[] }>(`${root}/exclusions`, {
        method: "PUT",
        body: input,
      }),
    deleteVisitors: (ids: string[]) =>
      http.request<{ deletedVisitors: number; deletedSessions: number; visitorDeleted: boolean }>(
        `${root}/bulk-delete`,
        { method: "POST", body: { ids } },
      ),
    deleteSession: (visitorId: string, sessionId: string) =>
      http.request<{ deletedVisitors: number; deletedSessions: number; visitorDeleted: boolean }>(
        `${root}/${encodeURIComponent(visitorId)}/sessions/${encodeURIComponent(sessionId)}`,
        { method: "DELETE" },
      ),
    list: (
      input: { page: number; pageSize: number; search: string; filters: Record<string, string> },
      signal?: AbortSignal,
    ) => {
      const params = new URLSearchParams({
        page: String(input.page),
        pageSize: String(input.pageSize),
        search: input.search,
      });
      for (const key of ["deviceType", "browser", "from", "to"])
        if (input.filters[key]) params.set(key, input.filters[key]);
      return http.request<Page<VisitorDto>>(`${root}?${params}`, { signal });
    },
    get: (id: string, signal?: AbortSignal, scope?: VisitorScopeInput) =>
      http.request<VisitorDto>(`${root}/${encodeURIComponent(id)}?${scopeParams(scope)}`, {
        signal,
      }),
    sessions: (id: string, page = 1, signal?: AbortSignal, scope?: VisitorScopeInput) =>
      http.request<Page<VisitorSessionDto>>(
        `${root}/${encodeURIComponent(id)}/sessions?page=${page}&pageSize=20&${scopeParams(scope)}`,
        { signal },
      ),
    sessionHistory: (
      id: string,
      scope: VisitorScopeInput,
      cursor?: string,
      signal?: AbortSignal,
    ) => {
      const params = scopeParams(scope);
      if (cursor) params.set("cursor", cursor);
      return http.request<VisitorSessionHistoryDto>(
        `${root}/${encodeURIComponent(id)}/session-history?${params}`,
        { signal },
      );
    },
    productReport: (scope: VisitorScopeInput, page = 1, signal?: AbortSignal) => {
      const params = scopeParams(scope);
      params.set("page", String(page));
      params.set("pageSize", "20");
      return http.request<VisitorProductPageDto>(`${root}/report/products?${params}`, { signal });
    },
    report: async (signal?: AbortSignal, scope?: VisitorScopeInput) => {
      const report = await http.request<VisitorReportDto>(`${root}/report?${scopeParams(scope)}`, {
        signal,
      });
      if (scope) assertReportScope(report, scope);
      return report;
    },
    filterOptions: (signal?: AbortSignal, scope?: VisitorScopeInput) =>
      http.request<VisitorFilters>(`${root}/filter-options?${scopeParams(scope)}`, { signal }),
  };
}
