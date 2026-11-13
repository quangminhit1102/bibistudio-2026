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
  phone?: string | null;
  avatarId?: string | null;
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
export interface VisitorContextFields {
  ipSource?: string | null;
  observedAt?: string | null;
  countryCode?: string | null;
  countryDataset?: string | null;
  countryResolvedAt?: string | null;
}
export interface VisitorDto extends VisitorContextFields {
  id: string;
  anonymousId: string;
  ipAddress: string;
  ipStatus?: VisitorIpStatus;
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
export interface VisitorSessionDto extends VisitorContextFields {
  id: string;
  visitorId: string;
  ipAddress?: string;
  ipStatus?: VisitorIpStatus;
  country?: string | null;
  deviceType?: string;
  operatingSystem?: string;
  browser?: string;
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
  totalInterestedVisitors?: number;
  totalProducts?: number;
  window?: VisitorWindowDto;
  bucketUnit?: VisitorBucketUnit;
  series?: { startUtc: string; label: string; sessions: number }[];
  products: { slug: string; name: string; interestedVisitors: number }[];
}
export type VisitorIpStatus = "verified" | "observed" | "legacy" | "unavailable";
export type VisitorBucketUnit = "hour" | "day" | "week" | "month" | "year";
export interface VisitorWindowDto {
  fromDate: string;
  toDate: string;
  startUtc: string;
  endUtcExclusive: string;
  asOf: string;
}
export interface VisitorScopeInput {
  from: string;
  to: string;
  deviceType?: "mobile" | "tablet" | "desktop";
  browser?: string;
  search?: string;
}
export interface VisitorSessionHistoryDto {
  items: VisitorSessionDto[];
  nextCursor: string | null;
  window: VisitorWindowDto;
}
export interface VisitorProductPageDto extends Page<{
  slug: string;
  name: string;
  interestedVisitors: number;
}> {
  window: VisitorWindowDto;
}
export interface CollectBatch {
  paths: string[];
  products: string[];
  lastPath: string;
}
export type { AccessLogRecord, AccessLogSyncReceipt, AccessLogStatus } from "../access-logs/types";
