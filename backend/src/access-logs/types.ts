export interface AccessLogRecord {
  id: string;
  sourceId: string;
  ordinal: number;
  occurredAt: string | null;
  method: string | null;
  pathname: string | null;
  status: number | null;
  bytes: number | null;
  ipPrefix: string | null;
  deviceType: string | null;
  operatingSystem: string | null;
  browser: string | null;
  resourceKind: "page" | "asset" | "api" | "other";
  isBot: boolean;
  referrer: string | null;
  parseStatus: "parsed" | "error";
  errorCode: string | null;
}
export interface AccessLogStatus {
  scope?: "current" | "archive";
  state: "never" | "complete" | "pending" | "error";
  total: number;
  parseErrors: number;
  earliest: string | null;
  latest: string | null;
  lastSyncAt: string | null;
  lastSuccessAt: string | null;
  sourceThrough: string | null;
  sourceModifiedAt?: string | null;
  stale: boolean;
  ipTrusted: boolean;
  timezone: string;
  lastRun: {
    state: string;
    inserted: number;
    parseErrors: number;
    pendingSources: number;
    divergedSources: number;
    missingSources: number;
  } | null;
  sources: {
    basename: string;
    transport: string;
    state: string;
    errorCode: string | null;
    recordCount: number;
    blankCount: number;
    sourceThrough: string | null;
    lastSeenAt: string | null;
    sourceModifiedAt?: string | null;
  }[];
}
export interface AccessLogCheckpoint {
  sourceId: string;
  basename: string;
  transport: "http" | "https";
  committedBytes: number;
  committedLines: number;
  recordCount: number;
  blankCount: number;
  prefixSha256: string;
}
export interface AccessLogSyncReceipt {
  state: "complete" | "pending" | "error";
  inserted: number;
  parseErrors: number;
  pendingSources: number;
  divergedSources: number;
  missingSources: number;
  sourceThrough: string | null;
  startedAt: string;
  finishedAt: string;
}
export interface AccessLogConfig {
  currentDirectory?: string;
  archiveDirectory: string;
  domainAlias: string;
  workDirectory: string;
  limits: {
    compressedBytes: number;
    expandedBytes: number;
    workBytes: number;
    lineBytes: number;
    batchRows: number;
    runMs: number;
  };
}
export interface ArchiveSource {
  basename: string;
  path: string;
  transport: "http" | "https";
}
export interface CurrentSnapshot {
  id: string;
  transport: "http" | "https";
  basename: string;
  path: string;
  sha256: string;
  bytes: number;
  sourceModifiedAt: string;
  capturedAt: string;
}
export interface ArchiveSnapshot extends ArchiveSource {
  compressedSha256: string;
}
