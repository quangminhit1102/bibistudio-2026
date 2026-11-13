import { describe, it, expect, vi } from "vitest";
import { sendVisitorBatch } from "../../src/lib/visitor-transport";
const batch = { paths: ["/contact"], products: [], lastPath: "/contact" };
describe("visitor PHP transport", () => {
  it("uses fixed PHP URL, credentials, exact JSON and keepalive with no auth/IP headers", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    expect(await sendVisitorBatch(batch, { keepalive: true, fetch: fetcher })).toEqual({
      status: 202,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, request] = fetcher.mock.calls[0];
    expect(url).toBe("/api/analytics/relay/collect.php");
    expect(request).toMatchObject({
      method: "POST",
      credentials: "include",
      keepalive: true,
      body: JSON.stringify(batch),
      headers: { "Content-Type": "application/json", "X-Bibi-Request": "1" },
    });
    expect(Object.keys(request.headers).sort()).toEqual(["Content-Type", "X-Bibi-Request"]);
  });
  it.each([404, 502, 503, 504, "network"])(
    "falls back once only for availability failure %s",
    async (status) => {
      const fetcher = vi.fn();
      if (status === "network") fetcher.mockRejectedValueOnce(new TypeError("offline"));
      else fetcher.mockResolvedValueOnce(new Response(null, { status }));
      fetcher.mockResolvedValueOnce(new Response(null, { status: 204 }));
      expect(await sendVisitorBatch(batch, { keepalive: false, fetch: fetcher })).toEqual({
        status: 204,
      });
      expect(fetcher.mock.calls.map((c) => c[0])).toEqual([
        "/api/analytics/relay/collect.php",
        "/api/analytics/collect",
      ]);
      expect(fetcher.mock.calls[0][1].body).toEqual(fetcher.mock.calls[1][1].body);
    },
  );
  it.each([202, 204, 400, 403, 409, 413, 429, 500])(
    "never downgrades response %s to unsigned retry",
    async (status) => {
      const fetcher = vi.fn().mockResolvedValue(new Response(null, { status }));
      expect((await sendVisitorBatch(batch, { keepalive: false, fetch: fetcher })).status).toBe(
        status,
      );
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it("does not loop on fallback failure or send after privacy preference changes", async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError("offline"));
    await expect(sendVisitorBatch(batch, { keepalive: false, fetch: fetcher })).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(2);
    const blocked = vi.fn();
    expect(
      (await sendVisitorBatch(batch, { keepalive: false, fetch: blocked, allowed: () => false }))
        .status,
    ).toBe(204);
    expect(blocked).not.toHaveBeenCalled();
    let allowed = true;
    const changing = vi.fn(async () => {
      allowed = false;
      return new Response(null, { status: 503 });
    });
    expect(
      (await sendVisitorBatch(batch, { keepalive: false, fetch: changing, allowed: () => allowed }))
        .status,
    ).toBe(204);
    expect(changing).toHaveBeenCalledTimes(1);
  });
});

it("drains status-only responses so browser requests can finish and release their body", async () => {
  const relayResponse = new Response("{}", { status: 202 });
  const fetcher = vi.fn().mockResolvedValue(relayResponse);
  expect((await sendVisitorBatch(batch, { keepalive: false, fetch: fetcher })).status).toBe(202);
  expect(relayResponse.bodyUsed).toBe(true);
  const unavailable = new Response("{}", { status: 503 }),
    fallback = new Response("{}", { status: 202 });
  const fallbackFetch = vi.fn().mockResolvedValueOnce(unavailable).mockResolvedValueOnce(fallback);
  await sendVisitorBatch(batch, { keepalive: false, fetch: fallbackFetch });
  expect(fallback.bodyUsed).toBe(true);
});
