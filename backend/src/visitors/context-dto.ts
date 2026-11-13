import type { RowDataPacket } from "mysql2/promise";
import type { VisitorIpStatus, VisitorContextFields } from "../http/contracts";
import { sqlDate } from "../auth/repository";
import ipaddr from "ipaddr.js";
export function effectiveVisitorStatus(row?: RowDataPacket): VisitorIpStatus {
  if (
    row?.ip_status === "unavailable" &&
    row.ip_source === "php_relay" &&
    row.ip_observed_at &&
    typeof row.client_ip === "string"
  ) {
    try {
      if (ipaddr.process(row.client_ip).range() === "unicast") return "observed";
    } catch {
      /* Invalid legacy data remains unavailable. */
    }
  }
  return row && ["verified", "observed", "legacy", "unavailable"].includes(row.ip_status)
    ? row.ip_status
    : "legacy";
}
export function visitorContextDto(row: RowDataPacket): VisitorContextFields & {
  ipAddress: string;
  ipStatus: VisitorIpStatus;
  country: string | null;
  city: string | null;
} {
  const status = effectiveVisitorStatus(row);
  const known = status === "verified" || status === "observed";
  const iso = (value: unknown) =>
    value instanceof Date
      ? value.toISOString()
      : typeof value === "string"
        ? sqlDate(value).toISOString()
        : null;
  return {
    ipAddress: known ? (row.client_ip ?? "") : "",
    ipStatus: status,
    ipSource: known ? (row.ip_source ?? null) : null,
    observedAt: known ? iso(row.ip_observed_at) : null,
    country: known
      ? (row.country_name ?? null)
      : status === "legacy"
        ? (row.country ?? null)
        : null,
    city: status === "legacy" ? (row.city ?? null) : null,
    countryCode: known ? (row.country_code ?? null) : null,
    countryDataset: known ? (row.country_dataset ?? null) : null,
    countryResolvedAt: known ? iso(row.country_resolved_at) : null,
  };
}
