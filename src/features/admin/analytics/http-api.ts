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
import type { AccessLogRecord, AccessLogStatus } from "../../../../backend/src/http/contracts";
export function createAccessLogApi(http: AdminHttpClient) {
  const root = "/api/customer-access/access-logs";
  return {
    list: (
      input: { page: number; pageSize: number; search: string; filters: Record<string, string> },
      signal?: AbortSignal,
    ) => {
      const params = new URLSearchParams({
        page: String(input.page),
        pageSize: String(input.pageSize),
        search: input.search,
        scope: input.filters.scope || "current",
      });
      for (const key of [
        "from",
        "to",
        "ipPrefix",
        "pathname",
        "status",
        "resourceKind",
        "isBot",
        "parseStatus",
      ])
        if (input.filters[key]) params.set(key, input.filters[key]);
      return http.request<Page<AccessLogRecord>>(`${root}?${params}`, { signal });
    },
    get: (id: string, scope: "current" | "archive" = "current", signal?: AbortSignal) =>
      http.request<AccessLogRecord>(`${root}/${encodeURIComponent(id)}?scope=${scope}`, { signal }),
    status: (scope: "current" | "archive" = "current", signal?: AbortSignal) =>
      http.request<AccessLogStatus>(`${root}/status?scope=${scope}`, { signal }),
  };
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
    report: (signal?: AbortSignal, scope?: VisitorScopeInput) =>
      http.request<VisitorReportDto>(`${root}/report?${scopeParams(scope)}`, { signal }),
    filterOptions: (signal?: AbortSignal, scope?: VisitorScopeInput) =>
      http.request<VisitorFilters>(`${root}/filter-options?${scopeParams(scope)}`, { signal }),
  };
}
