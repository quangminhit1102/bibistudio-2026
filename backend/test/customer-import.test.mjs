import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { createAuthFixture } from "./helpers/auth.mjs";
import { serve } from "./helpers/http.mjs";

async function fixture(t) {
  const f = await createAuthFixture(t, { visitorHistory: false, content: true });
  const { createApp } = await import("../dist/app.js");
  const base = await serve(
    t,
    createApp(
      { releaseId: "test", sourceSha: "test" },
      {
        db: f.pool,
        config: f.config,
        clock: f.clock,
        content: { schemaDirectory: resolve("backend/content-migrations") },
      },
    ),
  );
  const admin = await f.auth.login({ username: "admin", password: f.secrets.masterPassword });
  const request = (path, method = "GET", body, token = admin.accessToken, origin = true) =>
    fetch(base + "/api" + path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Bibi-Request": "1",
        ...(origin ? { Origin: f.config.allowedOrigins[0] } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const count = async () =>
    Number((await f.pool.query("SELECT COUNT(*) n FROM customers"))[0][0].n);
  return { ...f, request, count };
}
const row = (n, fields, action = "create", more = {}) => ({ row: n, action, fields, ...more });

test("customer fields round-trip and import preview matches existing and earlier file rows without writes", async (t) => {
  const f = await fixture(t);
  const response = await f.request("/customers", "POST", {
    name: "  Alpha  Shop ",
    kind: "company",
    phone: "012-345",
    email: "HELLO@example.com",
    representative: "An",
    extra: { zone: "north", rank: 2, ok: true, empty: null },
  });
  assert.equal(response.status, 201);
  const customer = await response.json();
  assert.equal(customer.representative, "An");
  assert.deepEqual(customer.extra, { zone: "north", rank: 2, ok: true, empty: null });
  const update = await f.request(`/customers/${customer.id}`, "PUT", {
    revision: 1,
    representative: "Bình",
    extra: { zone: "south" },
  });
  assert.equal(update.status, 200);
  const get = await (await f.request(`/customers/${customer.id}`)).json();
  assert.equal(get.representative, "Bình");
  assert.deepEqual(get.extra, { zone: "south" });
  const before = await f.count();
  const preview = await f.request("/customers/import", "POST", {
    dryRun: true,
    rows: [
      row(2, { name: "alpha shop", kind: "company" }),
      row(3, { name: "Other", kind: "individual", phone: "012345" }),
      row(4, { name: "Third", kind: "individual", email: "hello@EXAMPLE.com" }),
      row(5, { name: " File   Person ", kind: "individual" }),
      row(6, { name: "file person", kind: "individual" }),
    ],
  });
  assert.equal(preview.status, 200);
  const data = await preview.json();
  assert.equal(data.committed, false);
  assert.deepEqual(
    data.rows.slice(0, 3).map((r) => r.matches.find((m) => m.id === customer.id).by),
    [["name"], ["phone"], ["email"]],
  );
  assert.equal(data.rows[4].inFile, 5);
  assert.equal(data.rows[4].status, "duplicate");
  assert.equal(await f.count(), before);
  assert.equal(
    Number(
      (await f.pool.query("SELECT COUNT(*) n FROM audit_logs WHERE action='customer.import'"))[0][0]
        .n,
    ),
    0,
  );
});

test("import atomically creates, updates nonblank cells, skips and audits; empty batch succeeds", async (t) => {
  const f = await fixture(t);
  const old = await (
    await f.request("/customers", "POST", {
      name: "Old",
      kind: "company",
      phone: "0123",
      representative: "Keep",
      extra: { a: "keep", b: "old" },
    })
  ).json();
  const before = await f.count();
  const response = await f.request("/customers/import", "POST", {
    dryRun: false,
    rows: [
      row(2, { name: "CÔNG TY New", kind: "", vatRate: 0 }),
      row(
        3,
        { name: "Old", kind: "", phone: "  ", representative: "", extra: { a: "", b: "new" } },
        "update",
        { targetId: old.id, revision: 1 },
      ),
      row(4, { name: "Old", kind: "company" }, "skip"),
      row(5, { name: "Old", kind: "company" }),
    ],
  });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.deepEqual([data.created, data.updated, data.skipped, data.committed], [2, 1, 1, true]);
  assert.equal(await f.count(), before + 2);
  const get = await (await f.request(`/customers/${old.id}`)).json();
  assert.equal(get.phone, "0123");
  assert.equal(get.kind, "company");
  assert.equal(get.representative, "Keep");
  assert.deepEqual(get.extra, { a: "keep", b: "new" });
  assert.equal(get.revision, 2);
  const [[audit]] = await f.pool.query(
    "SELECT metadata FROM audit_logs WHERE action='customer.import' ORDER BY id DESC LIMIT 1",
  );
  const meta = typeof audit.metadata === "string" ? JSON.parse(audit.metadata) : audit.metadata;
  assert.deepEqual([meta.created, meta.updated, meta.skipped], [2, 1, 1]);
  assert.ok(meta.customerIds.includes(old.id));
  const empty = await f.request("/customers/import", "POST", { dryRun: false, rows: [] });
  assert.equal(empty.status, 200);
  assert.equal((await empty.json()).created, 0);
});

test("invalid import rows report row errors and stale revisions roll back every row", async (t) => {
  const f = await fixture(t);
  const old = await (
    await f.request("/customers", "POST", { name: "Old", kind: "company" })
  ).json();
  const before = await f.count();
  const invalid = [
    { name: "", kind: "individual" },
    { name: "x".repeat(256), kind: "company" },
    { name: "A", kind: "invalid" },
    { name: "B", kind: "company", email: "bad" },
    { name: "C", kind: "company", phone: "1".repeat(51) },
    { name: "D", kind: "company", vatRate: 101 },
    { name: "E", kind: "company", representative: "x".repeat(256) },
    { name: "F", kind: "company", extra: { x: "a".repeat(501) } },
    { name: 123, kind: "company" },
    { name: "G", kind: "company", phone: 123 },
    {
      name: "H",
      kind: "company",
      extra: Object.fromEntries(Array.from({ length: 31 }, (_, i) => [String(i), "x"])),
    },
  ];
  const rows = [
    row(1, { name: "Would create", kind: "individual" }),
    ...invalid.map((x, i) => row(i + 2, x)),
  ];
  const preview = await f.request("/customers/import", "POST", { dryRun: true, rows });
  assert.equal(preview.status, 200);
  assert.equal(
    (await preview.json()).rows.filter((r) => r.status === "error").length,
    invalid.length,
  );
  const bad = await f.request("/customers/import", "POST", { dryRun: false, rows });
  assert.equal(bad.status, 400);
  assert.equal(
    (await bad.json()).error.details.rows.filter((r) => r.status === "error").length,
    invalid.length,
  );
  assert.equal(await f.count(), before);
  await f.request(`/customers/${old.id}`, "PUT", { revision: 1, name: "Edited" });
  const stale = await f.request("/customers/import", "POST", {
    dryRun: false,
    rows: [
      row(1, { name: "Must rollback", kind: "individual" }),
      row(2, { name: "Old", kind: "company" }, "update", { targetId: old.id, revision: 1 }),
    ],
  });
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).error.code, "REVISION_CONFLICT");
  assert.equal(await f.count(), before);
  const huge = await f.request("/customers/import", "POST", {
    dryRun: true,
    rows: Array.from({ length: 1001 }, (_, i) => row(i + 1, { name: "X", kind: "individual" })),
  });
  assert.equal(huge.status, 400);
  assert.equal((await huge.json()).error.code, "TOO_MANY_ROWS");
  const maximum = await f.request("/customers/import", "POST", {
    dryRun: true,
    rows: Array.from({ length: 1000 }, (_, i) =>
      row(i + 1, { name: `Person ${i}`, kind: "individual" }),
    ),
  });
  assert.equal(maximum.status, 200);
  assert.equal((await maximum.json()).rows.length, 1000);
  assert.equal(await f.count(), before);
  assert.equal(
    (
      await f.request("/customers/import", "POST", {
        dryRun: true,
        rows: [{ row: 1, fields: null }],
      })
    ).status,
    400,
  );
});

test("blank optional cells and omitted skip action are safe, while repeated target revisions conflict atomically", async (t) => {
  const f = await fixture(t);
  const before = await f.count();
  const response = await f.request("/customers/import", "POST", {
    dryRun: false,
    rows: [
      row(1, { name: "Blank cells", kind: "", email: "", phone: "", representative: "" }),
      { row: 2, fields: { name: "Skipped invalid", email: "bad" } },
    ],
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).skipped, 1);
  assert.equal(await f.count(), before + 1);
  const old = await (
    await f.request("/customers", "POST", { name: "Old", kind: "company" })
  ).json();
  const repeated = await f.request("/customers/import", "POST", {
    dryRun: false,
    rows: [
      row(1, { name: "One" }, "update", { targetId: old.id, revision: 1 }),
      row(2, { name: "Two" }, "update", { targetId: old.id, revision: 1 }),
    ],
  });
  assert.equal(repeated.status, 409);
  assert.equal((await repeated.json()).error.code, "REVISION_CONFLICT");
  assert.equal((await (await f.request(`/customers/${old.id}`)).json()).name, "Old");
});

test("import enforces authentication, browser origin and fresh create/update permissions", async (t) => {
  const f = await fixture(t);
  const payload = { dryRun: true, rows: [] };
  assert.equal((await f.request("/customers/import", "POST", payload, "invalid")).status, 401);
  assert.equal(
    (await f.request("/customers/import", "POST", payload, undefined, false)).status,
    403,
  );
  const user = await f.auth.login({ username: "user01", password: f.secrets.userPassword });
  assert.equal(
    (await f.request("/customers/import", "POST", payload, user.accessToken)).status,
    403,
  );
  await f.pool.query("INSERT INTO role_permissions VALUES ('system-user','customer.create')");
  const creator = await f.auth.login({ username: "user01", password: f.secrets.userPassword });
  assert.equal(
    (await f.request("/customers/import", "POST", payload, creator.accessToken)).status,
    200,
  );
  const old = await (
    await f.request("/customers", "POST", { name: "Old", kind: "company" })
  ).json();
  const update = {
    dryRun: false,
    rows: [row(1, { name: "Old", kind: "company" }, "update", { targetId: old.id, revision: 1 })],
  };
  assert.equal(
    (await f.request("/customers/import", "POST", update, creator.accessToken)).status,
    403,
  );
});
