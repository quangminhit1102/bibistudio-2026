import test from "node:test";
import assert from "node:assert/strict";
import { createAccountFixture } from "./helpers/accounts.mjs";

test("master cannot be changed through any management route by self or another full-access Admin", async (t) => {
  const { request, auth, pool, admin } = await createAccountFixture(t);
  await pool.query(
    "INSERT INTO user_roles(user_id,role_id) SELECT id,'system-admin' FROM users WHERE username='user01'",
  );
  const otherAdmin = await auth.login({ username: "user01", password: "Only-test-Auth!88" });
  const [[before]] = await pool.execute("SELECT * FROM users WHERE id=?", [admin.profile.id]);
  const [rolesBefore] = await pool.execute(
    "SELECT * FROM user_roles WHERE user_id=? ORDER BY role_id",
    [admin.profile.id],
  );
  for (const token of [admin.accessToken, otherAdmin.accessToken]) {
    for (const [suffix, method, body] of [
      ["", "PUT", { revision: 1, displayName: "Changed" }],
      ["", "PUT", { revision: 1, password: "Only-test-New!66" }],
      ["", "DELETE", { revision: 1 }],
      ["/activate", "PATCH", { revision: 1 }],
      ["/deactivate", "PATCH", { revision: 1 }],
      ["/roles", "PATCH", { revision: 1, roleIds: ["system-user"] }],
    ])
      assert.equal(
        (await request(`/api/accounts/${admin.profile.id}${suffix}`, method, body, token)).status,
        403,
        suffix + method,
      );
  }
  const [[after]] = await pool.execute("SELECT * FROM users WHERE id=?", [admin.profile.id]);
  const [rolesAfter] = await pool.execute(
    "SELECT * FROM user_roles WHERE user_id=? ORDER BY role_id",
    [admin.profile.id],
  );
  assert.deepEqual(after, before);
  assert.deepEqual(rolesAfter, rolesBefore);
});
