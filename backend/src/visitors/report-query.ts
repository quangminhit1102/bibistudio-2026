import type { VisitorWindowDto } from "../http/contracts";
import { resolveVisitorWindow } from "./date-window";
import { createHash } from "node:crypto";
import ipaddr from "ipaddr.js";

export interface VisitorScope {
  from?: string;
  to?: string;
  search?: string;
  deviceType?: string;
  browser?: string;
}
export function visitorCohort(input: VisitorScope, now: Date, contextAvailable = false) {
  const window = resolveVisitorWindow({ from: input.from, to: input.to }, now);
  const clauses = ["v.is_probe=0", "s.started_at>=?", "s.started_at<?"];
  const params: (string | Date)[] = [new Date(window.startUtc), new Date(window.endUtcExclusive)];
  if (input.deviceType) {
    clauses.push("COALESCE(s.device_type,v.device_type)=?");
    params.push(input.deviceType);
  }
  if (input.browser) {
    clauses.push("COALESCE(s.browser,v.browser)=?");
    params.push(input.browser);
  }
  if (input.search?.trim()) {
    let search = input.search.trim();
    if ((search.includes(":") || /^(\d+\.){3}\d+$/.test(search)) && ipaddr.isValid(search))
      search = ipaddr.process(search).toString();
    const term = `%${search.replace(/[=%_]/g, (value) => "=" + value)}%`;
    const knownAddress = contextAvailable
      ? "(s.ip_status IN ('verified','observed') OR (s.ip_status='unavailable' AND s.ip_source='php_relay' AND s.ip_observed_at IS NOT NULL))"
      : "s.ip_status IN ('verified','observed')";
    clauses.push(
      `(IF(${knownAddress},s.client_ip,NULL) LIKE ? ESCAPE '=' OR (s.ip_status='legacy' AND v.ip_prefix LIKE ? ESCAPE '='))`,
    );
    params.push(term, term);
  }
  const sql = `SELECT s.*,v.ip_prefix,v.country,v.city,COALESCE(s.device_type,v.device_type) selected_device,COALESCE(s.operating_system,v.operating_system) selected_os,COALESCE(s.browser,v.browser) selected_browser FROM visitor_sessions s JOIN visitors v ON v.id=s.visitor_id WHERE ${clauses.join(" AND ")}`;
  return { window, params, sql };
}
export function visitorScopeFingerprint(id: string, input: VisitorScope, window: VisitorWindowDto) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        id,
        window.fromDate,
        window.toDate,
        input.search?.trim() ?? "",
        input.deviceType ?? "",
        input.browser ?? "",
      ]),
    )
    .digest("hex");
}
