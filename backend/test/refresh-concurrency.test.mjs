import test from "node:test";
import assert from "node:assert/strict";
import { createAuthFixture } from "./helpers/auth.mjs";

test("concurrent consumption has only one grant and reuse revokes its descendant", async (t) => {
  const { auth, secrets, pool } = await createAuthFixture(t);
  const first = await auth.login({ username: "user01", password: secrets.userPassword });
  const results = await Promise.allSettled([
    auth.refresh(first.refreshToken),
    auth.refresh(first.refreshToken),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const success = results.find((r) => r.status === "fulfilled").value;
  await assert.rejects(auth.refresh(success.refreshToken), (error) => error.status === 401);
  const [[row]] = await pool.query(
    "SELECT COUNT(*) n FROM refresh_token_sessions WHERE revoked_at IS NULL",
  );
  assert.equal(row.n, 0);
});

test("unknown refresh token cannot revoke another session", async (t) => {
  const { auth, secrets } = await createAuthFixture(t);
  const first = await auth.login({ username: "user01", password: secrets.userPassword });
  await assert.rejects(auth.refresh("a".repeat(43)), (error) => error.status === 401);
  assert.ok((await auth.refresh(first.refreshToken)).accessToken);
});
