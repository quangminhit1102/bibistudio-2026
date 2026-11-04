import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createAuthFixture } from "./helpers/auth.mjs";
const day = 86400000;

test("Admin and User log in with server permissions; JWT lasts 900seconds and DB stores refresh hashes only", async (t) => {
  const { auth, secrets, pool, clock } = await createAuthFixture(t);
  for (const [username, password, fullAccess] of [
    ["admin", secrets.masterPassword, true],
    ["user01", secrets.userPassword, false],
  ]) {
    const grant = await auth.login({ username, password });
    assert.equal(grant.profile.username, username);
    assert.equal(grant.profile.fullAccess, fullAccess);
    if (!fullAccess) assert.deepEqual(grant.profile.permissions, ["customer_access.view"]);
    const payload = JSON.parse(
      Buffer.from(grant.accessToken.split(".")[1], "base64url").toString(),
    );
    assert.equal(payload.exp - payload.iat, 900);
    assert.equal(payload.iss, "bibi-test");
    assert.equal(payload.aud, "bibi-admin-test");
    assert.equal(Date.parse(grant.expiresAt), +clock.now() + 900000);
    const [[stored]] = await pool.execute(
      "SELECT token_hash FROM refresh_tokens WHERE token_hash=?",
      [createHash("sha256").update(grant.refreshToken).digest("hex")],
    );
    assert.ok(stored);
    assert.notEqual(stored.token_hash, grant.refreshToken);
    assert.ok(!JSON.stringify(grant.profile).includes("password"));
  }
});

test("wrong, missing and inactive users return the same generic login error", async (t) => {
  const { auth, secrets, pool } = await createAuthFixture(t);
  const errors = [];
  for (const credentials of [
    { username: "missing", password: "wrong" },
    { username: "user01", password: "wrong" },
  ]) {
    try {
      await auth.login(credentials);
      assert.fail("login unexpectedly succeeded");
    } catch (error) {
      errors.push([error.status, error.code, error.message]);
    }
  }
  await pool.execute("UPDATE users SET active=0 WHERE username='user01'");
  try {
    await auth.login({ username: "user01", password: secrets.userPassword });
    assert.fail("inactive login succeeded");
  } catch (error) {
    errors.push([error.status, error.code, error.message]);
  }
  assert.equal(errors.length, 3);
  assert.equal(errors[0][0], 401);
  assert.deepEqual(errors[1], errors[0]);
  assert.deepEqual(errors[2], errors[0]);
});

test("access expiry can refresh, token rotation rejects old token and commits family revocation", async (t) => {
  const { auth, secrets, clock, pool } = await createAuthFixture(t);
  const first = await auth.login({ username: "user01", password: secrets.userPassword });
  clock.advance(900001);
  await assert.rejects(auth.authenticate(first.accessToken), (error) => error.status === 401);
  const next = await auth.refresh(first.refreshToken);
  assert.notEqual(next.refreshToken, first.refreshToken);
  assert.equal((await auth.authenticate(next.accessToken)).principal.username, "user01");
  await assert.rejects(auth.refresh(first.refreshToken), (error) => error.status === 401);
  await assert.rejects(auth.refresh(next.refreshToken), (error) => error.status === 401);
  await assert.rejects(auth.authenticate(next.accessToken), (error) => error.status === 401);
  const [[row]] = await pool.query("SELECT revoked_at,revoke_reason FROM refresh_token_sessions");
  assert.ok(row.revoked_at);
  assert.equal(row.revoke_reason, "token_reuse");
  const [[audit]] = await pool.query(
    "SELECT COUNT(*) n FROM audit_logs WHERE action='auth.token_reuse'",
  );
  assert.equal(audit.n, 1);
});

test("successful activity slides idle expiry but cannot exceed 30day absolute expiry", async (t) => {
  const { auth, secrets, clock, pool } = await createAuthFixture(t);
  let grant = await auth.login({ username: "user01", password: secrets.userPassword });
  const start = +clock.now();
  for (let iteration = 0; iteration < 5; iteration++) {
    clock.advance(6 * day - 1000);
    grant = await auth.refresh(grant.refreshToken);
  }
  const [[row]] = await pool.query(
    "SELECT idle_expires_at,absolute_expires_at FROM refresh_token_sessions",
  );
  assert.equal(Date.parse(row.absolute_expires_at.replace(" ", "T") + "Z"), start + 30 * day);
  assert.equal(row.idle_expires_at, row.absolute_expires_at);
  clock.set(new Date(start + 30 * day));
  await assert.rejects(auth.refresh(grant.refreshToken), (error) => error.status === 401);
});

test("idle expiry, logout and deactivation cannot revive a session", async (t) => {
  const { auth, secrets, clock, pool } = await createAuthFixture(t);
  const login = () => auth.login({ username: "user01", password: secrets.userPassword });
  const idle = await login();
  clock.advance(7 * day);
  await assert.rejects(auth.refresh(idle.refreshToken), (error) => error.status === 401);
  const logout = await login();
  await auth.logout(logout.refreshToken);
  await auth.logout(logout.refreshToken);
  await assert.rejects(auth.refresh(logout.refreshToken), (error) => error.status === 401);
  const disabled = await login();
  await pool.execute(
    "UPDATE users SET active=0,auth_version=auth_version+1 WHERE username='user01'",
  );
  await assert.rejects(auth.refresh(disabled.refreshToken), (error) => error.status === 401);
  await assert.rejects(auth.authenticate(disabled.accessToken), (error) => error.status === 401);
});

test("own all-session revoke invalidates every access token and refresh token", async (t) => {
  const { auth, secrets } = await createAuthFixture(t);
  const first = await auth.login({ username: "user01", password: secrets.userPassword });
  const second = await auth.login({ username: "user01", password: secrets.userPassword });
  const actor = await auth.authenticate(first.accessToken);
  await auth.revoke(actor, { all: true });
  for (const grant of [first, second]) {
    await assert.rejects(auth.authenticate(grant.accessToken), (error) => error.status === 401);
    await assert.rejects(auth.refresh(grant.refreshToken), (error) => error.status === 401);
  }
});
