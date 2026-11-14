import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { ApiError } from "../http/errors";
import { sqlDate } from "../auth/repository";
import type { RelayObservation } from "./relay-context";
import type { CountryLookup } from "./country-lookup";
import { assertVisitorContextReady } from "./context-schema";
import { effectiveVisitorStatus } from "./context-dto";
/** Replay state and history commit together. Cleanup only touches expired ephemeral receipts. */
export async function recordRelayReceipt(
  c: PoolConnection,
  observation: RelayObservation | undefined,
  now: Date,
) {
  await assertVisitorContextReady(c);
  if (observation) {
    try {
      await c.execute("INSERT INTO analytics_relay_receipts(request_id,expires_at) VALUES (?,?)", [
        Buffer.from(observation.requestId, "hex"),
        new Date(+observation.observedAt + 60000),
      ]);
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ER_DUP_ENTRY")
        throw new ApiError(409, "RELAY_REPLAY", "Yêu cầu đã được ghi nhận");
      throw error;
    }
  }
  // Nonlocking bounded selection followed by primary-key deletes avoids expiry-range gap locks.
  const [expired] = await c.execute<RowDataPacket[]>(
    "SELECT request_id FROM analytics_relay_receipts WHERE expires_at<? ORDER BY expires_at,request_id LIMIT 100",
    [now],
  );
  for (const row of expired)
    await c.execute("DELETE FROM analytics_relay_receipts WHERE request_id=? AND expires_at<?", [
      row.request_id,
      now,
    ]);
}
export async function writeVisitorContext(
  c: PoolConnection,
  input: {
    sessionId: string;
    current?: RowDataPacket;
    verifiedAddress: string | null;
    observation?: RelayObservation;
    countryLookup?: CountryLookup;
    now: Date;
  },
) {
  const { current, observation, now } = input;
  const currentStatus = effectiveVisitorStatus(current);
  if (current && currentStatus !== current.ip_status)
    await c.execute("UPDATE visitor_sessions SET ip_status=? WHERE id=?", [
      currentStatus,
      input.sessionId,
    ]);
  const chosen = input.verifiedAddress
    ? { ip: input.verifiedAddress, at: now, status: "verified", source: "trusted_proxy" }
    : observation
      ? { ip: observation.ip, at: observation.observedAt, status: "observed", source: "php_relay" }
      : null;
  if (chosen) {
    if (currentStatus === "verified" && chosen.status !== "verified") return;
    if (current?.ip_observed_at && +sqlDate(current.ip_observed_at) > +chosen.at) return;
    // A session snapshot remains tied to its IP and original resolution time.
    const retained =
      current &&
      current.client_ip === chosen.ip &&
      current.country_code &&
      current.country_name &&
      current.country_dataset &&
      current.country_resolved_at
        ? {
            code: current.country_code,
            name: current.country_name,
            dataset: current.country_dataset,
            resolvedAt: current.country_resolved_at,
          }
        : null;
    let country = retained
      ? { code: retained.code, name: retained.name, dataset: retained.dataset }
      : null;
    if (!retained) {
      try {
        country = input.countryLookup?.lookup(chosen.ip) ?? null;
      } catch {
        /* A changed IP never inherits the previous IP's country. */
      }
    }
    await c.execute(
      "UPDATE visitor_sessions SET client_ip=?,ip_status=?,ip_source=?,ip_observed_at=?,country_code=?,country_name=?,country_dataset=?,country_resolved_at=? WHERE id=?",
      [
        chosen.ip,
        chosen.status,
        chosen.source,
        chosen.at,
        country?.code ?? null,
        country?.name ?? null,
        country?.dataset ?? null,
        retained?.resolvedAt ?? (country ? now : null),
        input.sessionId,
      ],
    );
  } else if (!["verified", "observed"].includes(currentStatus))
    await c.execute(
      "UPDATE visitor_sessions SET client_ip=NULL,ip_status='unavailable',ip_source=NULL,ip_observed_at=NULL,country_code=NULL,country_name=NULL,country_dataset=NULL,country_resolved_at=NULL WHERE id=?",
      [input.sessionId],
    );
}
