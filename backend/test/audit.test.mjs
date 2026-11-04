import test from "node:test";
import assert from "node:assert/strict";
import { createAccountFixture } from "./helpers/accounts.mjs";

test("audit API is permission-checked, paginated and exposes safe event metadata only", async (t) => {
  const { request, auth } = await createAccountFixture(t);
  const user = await auth.login({ username: "user01", password: "Only-test-Auth!88" });
  assert.equal((await request("/api/audit", "GET", undefined, user.accessToken)).status, 403);
  const result = await request("/api/audit?page=1&pageSize=2");
  assert.equal(result.status, 200);
  assert.equal(result.body.items.length, 2);
  assert.ok(result.body.total >= 4);
  assert.equal(result.body.page, 1);
  assert.ok(!JSON.stringify(result.body).match(/password_hash|refreshToken|token_hash|Only-test/));
  assert.equal((await request("/api/audit?pageSize=10000")).status, 400);
});
