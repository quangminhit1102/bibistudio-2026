import test from "node:test";
import assert from "node:assert/strict";
import { accessLogLine as line } from "./helpers/access-logs.mjs";
import { parseAccessLogLine as parse } from "../dist/access-logs/parse.js";

test("combined records normalize time, labels and masked IP without query or raw UA", () => {
  const row = parse(line(), "s", 1);
  assert.equal(row.parseStatus, "parsed");
  assert.equal(row.occurredAt, "2026-11-05T07:00:01.000Z");
  assert.equal(row.ipPrefix, "203.0.113.0/24");
  assert.equal(row.pathname, "/products/a");
  assert.equal(row.referrer, "https://example.com/story");
  assert.equal(row.browser, "Chrome");
  assert.equal(row.operatingSystem, "Windows");
  assert.equal(row.resourceKind, "page");
  assert.equal(row.bytes, 123);
  assert.equal(row.status, 200);
  assert.ok(!JSON.stringify(row).includes("secret"));
  assert.ok(!JSON.stringify(row).includes("Mozilla"));
  assert.ok(!JSON.stringify(row).includes("203.0.113.42"));
});
test("duplicate physical records have distinct stable position IDs", () => {
  assert.equal(parse(line(), "s", 1).id, parse(line(), "s", 1).id);
  assert.notEqual(parse(line(), "s", 1).id, parse(line(), "s", 2).id);
  assert.notEqual(parse(line(), "s", 1).id, parse(line(), "https", 1).id);
  assert.equal(parse(Buffer.from("  "), "s", 3), null);
});
test("IPv6 and mapped IPv4 use existing network-prefix policy", () => {
  assert.equal(parse(line({ ip: "2001:db8:abcd:1234::1" }), "s", 1).ipPrefix, "2001:db8:abcd::/48");
  assert.equal(parse(line({ ip: "::ffff:203.0.113.42" }), "s", 2).ipPrefix, "203.0.113.0/24");
});
test("escaped quotes and backslashes cannot break field boundaries", () => {
  const row = parse(
    line({
      request: 'GET /a"b?token=x HTTP/2.0',
      agent: 'something "quoted" Android Mobile Firefox/130.0',
    }),
    "s",
    1,
  );
  assert.equal(row.parseStatus, "parsed");
  assert.equal(row.pathname, '/a"b');
  assert.equal(row.deviceType, "mobile");
  assert.equal(row.browser, "Firefox");
});
test("Apache hex escapes decode while malformed escape/trailing fields get safe markers", () => {
  const hex = line({ request: "GET /a b HTTP/1.1" }).toString().replace("/a b", "/a\\x20b");
  assert.equal(parse(Buffer.from(hex), "s", 1).pathname, "/a b");
  assert.equal(
    parse(Buffer.from(line().toString() + " hidden-secret"), "s", 2).parseStatus,
    "error",
  );
});
test("missing bytes, referrer and cross-calendar timestamps are preserved honestly", () => {
  const row = parse(
    line({ time: "31/Oct/2026:23:10:00 -0230", bytes: "-", referrer: "-" }),
    "nov-source",
    1,
  );
  assert.equal(row.occurredAt, "2026-11-01T01:40:00.000Z");
  assert.equal(row.bytes, null);
  assert.equal(row.referrer, null);
});
test("invalid encoding, IP, date and syntax produce marker rows without source contents", () => {
  for (const bytes of [
    Buffer.from([255]),
    line({ ip: "bad-ip" }),
    line({ time: "31/Feb/2026:14:00:01 +0700" }),
    line({ time: "05/Nov/2026:99:00:00 +0700" }),
    line({ status: "999" }),
    Buffer.from("broken secret=123"),
  ]) {
    const row = parse(bytes, "s", 1);
    assert.equal(row.parseStatus, "error");
    assert.equal(row.pathname, null);
    assert.equal(row.ipPrefix, null);
    assert.ok(row.errorCode);
    assert.ok(!JSON.stringify(row).includes("secret"));
  }
});
test("HTML is text, referrer credentials/query are stripped, API/asset/bot are labels", () => {
  const row = parse(
    line({
      request: "GET /<script>alert(1)</script>?password=x HTTP/1.1",
      referrer: "https://user:pass@example.com/a?key=x#b",
    }),
    "s",
    1,
  );
  assert.equal(row.pathname, "/<script>alert(1)</script>");
  assert.equal(row.referrer, "https://example.com/a");
  assert.equal(parse(line({ request: "GET /api/health HTTP/1.1" }), "s", 2).resourceKind, "api");
  assert.equal(
    parse(line({ request: "GET /catalogue/a.jpeg HTTP/1.1", agent: "Googlebot/2.1" }), "s", 3)
      .resourceKind,
    "asset",
  );
  assert.equal(parse(line({ agent: "Googlebot/2.1" }), "s", 4).isBot, true);
});
test("unsafe positions and output length limits do not silently round or truncate identity", () => {
  assert.throws(() => parse(line(), "s", Number.MAX_SAFE_INTEGER + 1), /position/i);
  assert.throws(() => parse(line(), "s", 0), /position/i);
  assert.equal(
    parse(line({ request: "GET /" + "x".repeat(3000) + " HTTP/1.1" }), "s", 2).parseStatus,
    "error",
  );
});
