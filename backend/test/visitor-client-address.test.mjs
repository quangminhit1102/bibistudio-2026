import test from "node:test";
import assert from "node:assert/strict";
import { resolveClientAddress } from "../dist/http/client-address.js";
import { readAuthConfig } from "../dist/config.js";
const context = { peer: "127.0.0.1", sourceVerified: true, trustedCidrs: ["127.0.0.1/32"] };
test("only a measured trusted peer can supply a full public client address", () => {
  for (const [ip, address] of [
    ["8.8.8.8", "8.8.8.8"],
    ["::ffff:8.8.4.4", "8.8.4.4"],
    ["2606:4700:4700::1111", "2606:4700:4700::1111"],
  ]) {
    assert.deepEqual(resolveClientAddress({ ...context, ip }), { address, status: "verified" });
  }
  for (const patch of [
    { sourceVerified: false },
    { peer: "10.0.0.1" },
    { peer: undefined },
    { trustedCidrs: [] },
    { trustedCidrs: ["bad"] },
  ]) {
    assert.deepEqual(resolveClientAddress({ ...context, ip: "8.8.8.8", ...patch }), {
      address: null,
      status: "unavailable",
    });
  }
});
test("never exposes private, reserved, loopback, scoped or malformed values", () => {
  for (const ip of [
    "127.0.0.1",
    "10.0.0.1",
    "192.168.1.1",
    "100.64.0.1",
    "192.0.2.1",
    "198.51.100.1",
    "203.0.113.1",
    "169.254.1.1",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "fc00::1",
    "fe80::1%eth0",
    "2001:db8::1",
    "8.8.8.8, 1.1.1.1",
    "bad",
    undefined,
  ]) {
    assert.deepEqual(resolveClientAddress({ ...context, ip }), {
      address: null,
      status: "unavailable",
    });
  }
});
test("full IP opt-in defaults off and requires explicit narrow proxy CIDRs", () => {
  const env = { AUTH_JWT_SECRET: "x".repeat(32), AUTH_ALLOWED_ORIGINS: "http://localhost:5173" };
  assert.equal(readAuthConfig(env).clientIpSourceVerified, false);
  assert.throws(() => readAuthConfig({ ...env, CLIENT_IP_SOURCE_VERIFIED: "true" }));
  assert.throws(() => readAuthConfig({ ...env, CLIENT_IP_SOURCE_VERIFIED: "yes" }));
  for (const cidr of ["0.0.0.0/0", "::/0", "127.0.0.1/8"])
    assert.throws(() =>
      readAuthConfig({ ...env, CLIENT_IP_SOURCE_VERIFIED: "true", TRUSTED_PROXY_CIDRS: cidr }),
    );
  assert.equal(
    readAuthConfig({
      ...env,
      CLIENT_IP_SOURCE_VERIFIED: "true",
      TRUSTED_PROXY_CIDRS: "127.0.0.1/32",
    }).clientIpSourceVerified,
    true,
  );
});
