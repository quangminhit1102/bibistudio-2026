/** Shared wire types only. No Node or browser runtime dependencies. */
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface RoleOptionDto {
  id: string;
  name: string;
}
export interface PrincipalDto {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  roleIds: string[];
  roles: RoleOptionDto[];
  permissions: string[];
  fullAccess: boolean;
  isMaster: boolean;
  revision: number;
}
export interface AccountDto extends PrincipalDto {
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface RoleDto {
  id: string;
  name: string;
  description: string;
  isSystem: boolean;
  fullAccess: boolean;
  revision: number;
  permissionIds: string[];
}
export interface PermissionDto {
  id: string;
  code: string;
  description: string;
}
export interface AuditDto {
  id: string;
  actorId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}
export interface VisitorDto {
  id: string;
  anonymousId: string;
  ipAddress: string;
  country: string | null;
  city: string | null;
  deviceType: string;
  operatingSystem: string;
  browser: string;
  firstSeenAt: string;
  lastSeenAt: string;
  sessionCount: number;
  distinctPageCount: number;
}
export interface VisitorSessionDto {
  id: string;
  visitorId: string;
  startedAt: string;
  lastReceivedAt: string;
  landingPath: string;
  lastReceivedPath: string;
  distinctPageCount: number;
  truncated: boolean;
  pages: { path: string; firstReceivedAt: string; lastReceivedAt: string }[];
  products: { slug: string; name: string; firstReceivedAt: string; lastReceivedAt: string }[];
}
export interface VisitorReportDto {
  totalVisitors: number;
  totalSessions: number;
  products: { slug: string; name: string; interestedVisitors: number }[];
}
export interface CollectBatch {
  paths: string[];
  products: string[];
  lastPath: string;
}
export type { AccessLogRecord, AccessLogSyncReceipt } from "../access-logs/types";
export type AccessLogStatus = Awaited<
  ReturnType<
    ReturnType<typeof import("../access-logs/read-service").createAccessLogReadService>["status"]
  >
>;
