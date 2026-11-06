import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { createAccountFixture } from "./helpers/accounts.mjs";
import { migrateProfiles } from "../dist/profile/schema.js";
import { normalizePhone } from "../dist/profile/validation.js";
test("phone normalization retains leading zero/country prefix and rejects ambiguous input", () => {
  assert.equal(normalizePhone("0392 969-000"), "0392969000");
  assert.equal(normalizePhone("+84 (392) 969000"), "+84392969000");
  for (const value of [null, undefined, "", "  "]) assert.equal(normalizePhone(value), null);
  for (const value of [
    "abc1234567",
    "1234567 ext9",
    "12+3456789",
    "++841234567",
    "1234",
    "1".repeat(16),
    23,
  ])
    assert.throws(() => normalizePhone(value));
});
test("account management persists nonunique phone with permission/revision/Master protection", async (t) => {
  const f = await createAccountFixture(t);
  await migrateProfiles(f.pool, resolve("backend/profile-migrations"));
  for (const username of ["phonea", "phoneb"]) {
    const created = await f.request("/api/accounts", "POST", {
      username,
      password: "Only-test-Phone!88",
      displayName: "Kiểm thử",
      roleIds: [],
      phone: "0392 969 000",
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.phone, "0392969000");
    assert.equal(created.body.avatarId, null);
    const updated = await f.request("/api/accounts/" + created.body.id, "PUT", {
      revision: created.body.revision,
      phone: "+84 392 969000",
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.phone, "+84392969000");
  }
  const master = (await f.request("/api/accounts?search=admin")).body.items.find((u) => u.isMaster);
  assert.equal(
    (
      await f.request("/api/accounts/" + master.id, "PUT", {
        revision: master.revision,
        phone: "0392969000",
      })
    ).status,
    403,
  );
  const user = await f.auth.login({ username: "user01", password: f.secrets.userPassword });
  assert.equal(
    (
      await f.request(
        "/api/accounts/" + master.id,
        "PUT",
        { revision: master.revision, phone: null },
        user.accessToken,
      )
    ).status,
    403,
  );
});
