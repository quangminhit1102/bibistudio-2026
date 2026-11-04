import test from "node:test";
import assert from "node:assert/strict";
import { createAccountFixture } from "./helpers/accounts.mjs";

test("management APIs enforce missing token401 and User permission403; server computes multi-role permission union", async (t) => {
  const { request, auth, pool } = await createAccountFixture(t);
  const user = await auth.login({ username: "user01", password: "Only-test-Auth!88" });
  assert.equal((await request("/api/accounts", "GET", undefined, "")).status, 401);
  assert.equal((await request("/api/accounts", "GET", undefined, user.accessToken)).status, 403);
  await pool.query("INSERT INTO roles(id,name) VALUES ('test-reader','Reader')");
  await pool.query(
    "INSERT INTO role_permissions(role_id,permission_id) VALUES ('test-reader','account.view')",
  );
  await pool.execute("INSERT INTO user_roles(user_id,role_id) VALUES (?,'test-reader')", [
    user.profile.id,
  ]);
  const principal = (await auth.authenticate(user.accessToken)).principal;
  assert.deepEqual(principal.permissions, ["account.view", "customer_access.view"]);
  assert.equal(principal.roleIds.length, 2);
  assert.equal((await request("/api/accounts", "GET", undefined, user.accessToken)).status, 200);
  await pool.execute("UPDATE users SET active=0,auth_version=auth_version+1 WHERE id=?", [
    user.profile.id,
  ]);
  assert.equal((await request("/api/accounts", "GET", undefined, user.accessToken)).status, 401);
});

test("DB outage returns503 without falling back to fixture authority", async (t) => {
  const { request, close } = await createAccountFixture(t);
  await close();
  const response = await request("/api/accounts");
  assert.equal(response.status, 503);
  assert.equal(response.body.error.code, "SERVICE_UNAVAILABLE");
});
