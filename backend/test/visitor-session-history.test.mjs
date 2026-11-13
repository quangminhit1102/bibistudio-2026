import test from "node:test";
import assert from "node:assert/strict";
import { createVisitorFixture } from "./helpers/visitors.mjs";
import { createVisitorService } from "../dist/visitors/service.js";
test("cursor history loads 45 equal-time sessions exactly once and binds filters", async (t) => {
  const f = await createVisitorFixture(t);
  await f.collect(f.batch, f.cookie);
  const [[visitor]] = await f.pool.query("SELECT id FROM visitors");
  for (let n = 0; n < 44; n++)
    await f.pool.query(
      "INSERT INTO visitor_sessions(id,visitor_id,started_at,last_received_at,landing_path,last_received_path) VALUES(?,?,?,?,'/','/')",
      [`session-${String(n).padStart(3, "0")}`, visitor.id, f.clock.now(), f.clock.now()],
    );
  const api = createVisitorService(f.pool, f.catalogue, f.clock);
  const scope = { from: "2026-11-01", to: "2026-11-30" };
  const first = await api.sessionHistory(visitor.id, scope);
  assert.equal(first.items.length, 20);
  const second = await api.sessionHistory(visitor.id, { ...scope, cursor: first.nextCursor });
  assert.equal(second.items.length, 20);
  const third = await api.sessionHistory(visitor.id, { ...scope, cursor: second.nextCursor });
  assert.equal(third.items.length, 5);
  assert.equal(third.nextCursor, null);
  assert.equal(
    new Set([...first.items, ...second.items, ...third.items].map((s) => s.id)).size,
    45,
  );
  assert.deepEqual(
    await api.sessionHistory(visitor.id, { ...scope, cursor: first.nextCursor }),
    second,
  );
  for (const patch of [{ from: "2026-11-02" }, { browser: "Edge" }, { search: "8.8" }])
    await assert.rejects(
      api.sessionHistory(visitor.id, { ...scope, ...patch, cursor: first.nextCursor }),
      { status: 400 },
    );
  await assert.rejects(api.sessionHistory(visitor.id, { ...scope, cursor: "garbage" }), {
    status: 400,
  });
  assert.deepEqual(
    (await api.sessionHistory(visitor.id, { from: "2021-01-01", to: "2021-01-01" })).items,
    [],
  );
});
