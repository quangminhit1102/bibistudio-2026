import type {
  Page,
  VisitorDto,
  VisitorSessionDto,
  VisitorReportDto,
} from "../../../../backend/src/http/contracts";
import type { AdminHttpClient } from "../../../lib/admin-http";
export interface VisitorFilters {
  deviceTypes: string[];
  operatingSystems: string[];
  browsers: string[];
  products: { slug: string; name: string }[];
}
export function createVisitorApi(http: AdminHttpClient) {
  const root = "/api/customer-access";
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
      for (const key of ["deviceType", "browser", "product"])
        if (input.filters[key]) params.set(key, input.filters[key]);
      return http.request<Page<VisitorDto>>(`${root}?${params}`, { signal });
    },
    get: (id: string, signal?: AbortSignal) =>
      http.request<VisitorDto>(`${root}/${encodeURIComponent(id)}`, { signal }),
    sessions: (id: string, page = 1, signal?: AbortSignal) =>
      http.request<Page<VisitorSessionDto>>(
        `${root}/${encodeURIComponent(id)}/sessions?page=${page}&pageSize=20`,
        { signal },
      ),
    report: (signal?: AbortSignal) => http.request<VisitorReportDto>(`${root}/report`, { signal }),
    filterOptions: (signal?: AbortSignal) =>
      http.request<VisitorFilters>(`${root}/filter-options`, { signal }),
  };
}
