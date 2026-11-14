import assert from "node:assert/strict";
import test from "node:test";
import { verifyContentHostReceipt } from "./content-host-spike.mjs";

// Entirely synthetic. This fixture proves validation behavior, never hosting feasibility.
const digest = "a".repeat(64);
const codec = {
  node: "v24.22.1",
  sharp: "0.35.5",
  dompurify: "3.4.17",
  jsdom: "30.1.3",
  commonjs: true,
  jpeg: true,
  png: true,
  webp: true,
  metadataStripped: true,
  maliciousMarkupRemoved: true,
  cjsSha256: digest,
};
const validReceipt = {
  version: 1,
  readerVersion: 1,
  measuredAt: "2026-11-14T01:00:00.000Z",
  headMeasured: true,
  headStatus: 200,
  headBytes: 0,
  htmlStatus: 200,
  htmlSha256: digest,
  expectedHtmlSha256: digest,
  contentType: "text/html; charset=utf-8",
  cacheControl: "no-store",
  redirectStatus: 301,
  redirectLocationMatched: true,
  notFoundStatus: 404,
  notFoundMarkerMatched: true,
  privateMapDenied: true,
  pathEscapeDenied: true,
  pointerBodies: ["cms-canary-a", "cms-canary-b", "cms-canary-a"],
  reservedRoutes: ["root", "api", "node-test"].map((name) => ({
    name,
    before: digest,
    after: digest,
    statusBefore: 200,
    statusAfter: 200,
  })),
  cleanupVerified: true,
  php: "8.3.36",
  libc: "2.28",
  localCodec: { ...codec, platform: "win32" },
  hostCodec: { ...codec, platform: "linux" },
  accountQuota: {
    source: "cpanel-account",
    limitBytes: 21474836480,
    usedBytes: 1073741824,
    requiredAdditionalBytes: 4294967296,
  },
};
const copy = () => structuredClone(validReceipt);

test("accepts a complete measured-receipt shape", () => {
  assert.deepEqual(verifyContentHostReceipt(copy()), { ok: true, readerVersion: 1 });
});

test("rejects an unmeasured HEAD/routing gate", () => {
  assert.throws(() => verifyContentHostReceipt({ ...copy(), headMeasured: false }), /HEAD/);
  const receipt = copy();
  delete receipt.headMeasured;
  assert.throws(() => verifyContentHostReceipt(receipt), /HEAD/);
});

test("rejects a successful soft-404 or a WAF error instead of PHP's not-found page", () => {
  assert.throws(() => verifyContentHostReceipt({ ...copy(), notFoundStatus: 200 }), /404/);
  assert.throws(() => verifyContentHostReceipt({ ...copy(), notFoundMarkerMatched: false }), /404/);
});

test("rejects stale PHP pointer/cache reads", () => {
  assert.throws(
    () =>
      verifyContentHostReceipt({
        ...copy(),
        pointerBodies: ["cms-canary-a", "cms-canary-a", "cms-canary-a"],
      }),
    /pointer/,
  );
});

test("rejects any reserved routing mutation or missing reservation", () => {
  const receipt = copy();
  receipt.reservedRoutes[1].after = "b".repeat(64);
  assert.throws(() => verifyContentHostReceipt(receipt), /reserved/);
  assert.throws(() => verifyContentHostReceipt({ ...copy(), reservedRoutes: [] }), /reserved/);
});

test("rejects a missing codec or CommonJS sanitizer proof on either platform", () => {
  for (const target of ["localCodec", "hostCodec"]) {
    for (const field of [
      "webp",
      "jpeg",
      "png",
      "metadataStripped",
      "commonjs",
      "maliciousMarkupRemoved",
    ]) {
      const receipt = copy();
      receipt[target][field] = false;
      assert.throws(() => verifyContentHostReceipt(receipt), /codec|CommonJS/);
    }
  }
});

test("rejects whole-machine free space and insufficient account headroom", () => {
  const receipt = copy();
  receipt.accountQuota.source = "statfs";
  assert.throws(() => verifyContentHostReceipt(receipt), /account quota/);
  receipt.accountQuota.source = "cpanel-account";
  receipt.accountQuota.limitBytes = 2 ** 30;
  assert.throws(() => verifyContentHostReceipt(receipt), /headroom/);
});

test("rejects mismatched HTML, body on HEAD, private exposure and incomplete cleanup", () => {
  for (const patch of [
    { htmlSha256: "b".repeat(64) },
    { headBytes: 1 },
    { privateMapDenied: false },
    { pathEscapeDenied: false },
    { cleanupVerified: false },
  ]) {
    assert.throws(() => verifyContentHostReceipt({ ...copy(), ...patch }));
  }
});
