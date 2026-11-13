import type { CollectBatch } from "../../backend/src/http/contracts";
const unavailable = new Set([404, 502, 503, 504]);
/** One availability fallback; batching, bootstrap and retry budgets remain tracker-owned. */
export async function sendVisitorBatch(
  batch: CollectBatch,
  options: { keepalive: boolean; fetch?: typeof fetch; allowed?: () => boolean },
): Promise<{ status: number }> {
  const allowed = options.allowed ?? (() => true);
  if (!allowed()) return { status: 204 };
  const fetcher = options.fetch ?? globalThis.fetch;
  const request: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bibi-Request": "1" },
    credentials: "include",
    body: JSON.stringify(batch),
    keepalive: options.keepalive,
  };
  let response: Response | undefined;
  try {
    response = await fetcher("/api/analytics/relay/collect.php", request);
  } catch {
    /* A network failure may use the one unsigned fallback. */
  }
  if (response) {
    // A status-only API still needs its response drained to finish browser fetches.
    // A failed body read after headers must not replay an already accepted batch.
    await response.arrayBuffer().catch(() => {});
    if (!unavailable.has(response.status)) return { status: response.status };
  }
  if (!allowed()) return { status: 204 };
  const fallback = await fetcher("/api/analytics/collect", request);
  await fallback.arrayBuffer().catch(() => {});
  return { status: fallback.status };
}
