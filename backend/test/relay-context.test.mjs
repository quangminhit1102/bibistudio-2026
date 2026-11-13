import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, createHash } from "node:crypto";
import { verifyRelayContext } from "../dist/visitors/relay-context.js";
const secret = Buffer.alloc(32, 7).toString("base64url"),
  now = new Date("2026-11-13T00:00:00Z"),
  timestamp = now.getTime() / 1000;
const sha = (s) => createHash("sha256").update(s).digest("hex"),
  b64 = (s) => Buffer.from(s).toString("base64url");
const base = {
  rawBody: Buffer.from('{"pages":[]}'),
  cookie: "anonymous-only",
  origin: "https://bibistudio.vn",
  userAgent: "Browser tiếng Việt",
  dnt: false,
  gpc: false,
  now,
  secret,
};
function signed(changes = {}, rawOverride) {
  const f = { timestamp, requestId: "a".repeat(32), ip: "8.8.8.8", ...changes };
  const raw =
    rawOverride ??
    [
      "bibi-analytics-v1",
      f.timestamp,
      f.requestId,
      "POST",
      "/api/analytics/collect",
      sha(base.rawBody),
      f.ip,
      b64(base.origin),
      sha(base.cookie),
      b64(base.userAgent),
      "0",
      "0",
      "",
    ].join("\n");
  return {
    context: b64(raw),
    signature: createHmac("sha256", Buffer.from(secret, "base64url")).update(raw).digest("hex"),
  };
}
test("valid relay verifies exact canonical bytes, cookie value and public IP", () => {
  assert.deepEqual(verifyRelayContext({ ...base, ...signed() }), {
    ip: "8.8.8.8",
    observedAt: now,
    requestId: "a".repeat(32),
    source: "php_relay",
  });
  assert.equal(
    verifyRelayContext({ ...base, ...signed({ ip: "2001:4860:4860::8888" }) }).ip,
    "2001:4860:4860::8888",
  );
});
test("body/cookie/origin/UA/privacy substitutions and duplicate headers fail closed", () => {
  for (const override of [
    { rawBody: Buffer.from("{}") },
    { cookie: "other" },
    { origin: "https://evil.test" },
    { userAgent: "Other" },
    { dnt: true },
    { gpc: true },
    { context: [signed().context, signed().context] },
    { signature: [signed().signature, signed().signature] },
    { signature: "0".repeat(64) },
    { secret: Buffer.alloc(32, 8).toString("base64url") },
  ])
    assert.throws(
      () => verifyRelayContext({ ...base, ...signed(), ...override }),
      (e) => e.status === 403 && e.code === "INVALID_RELAY_CONTEXT",
    );
});
test("rejects expired/future/noncanonical/address/ID/version payloads even when signed", () => {
  for (const change of [
    { timestamp: timestamp - 31 },
    { timestamp: timestamp + 6 },
    { timestamp: "0" + timestamp },
    { requestId: "A".repeat(32) },
    { requestId: "short" },
    { ip: "127.0.0.1" },
    { ip: "192.0.2.1" },
    { ip: "::ffff:8.8.8.8" },
    { ip: "2001:4860:4860:0:0:0:0:8888" },
    { ip: "8.8.8.8,1.1.1.1" },
  ])
    assert.throws(() => verifyRelayContext({ ...base, ...signed(change) }));
  const canonical = Buffer.from(signed().context, "base64url").toString();
  for (const raw of [
    canonical + "extra\n",
    canonical.replace("v1", "v2"),
    canonical.replace("POST", "GET"),
    canonical.replace("/collect", "/other"),
    canonical.replace("\n0\n0\n", "\nfalse\n0\n"),
  ])
    assert.throws(() => verifyRelayContext({ ...base, ...signed({}, raw) }));
  assert.throws(() =>
    verifyRelayContext({ ...base, ...signed(), context: signed().context + "=" }),
  );
});
