import test from "node:test";
import assert from "node:assert/strict";
import { createAuthFixture } from "./helpers/auth.mjs";
import { serve } from "./helpers/http.mjs";
import { createApp } from "../dist/app.js";

test("HTTP login/profile/rotation/logout use a host-only HttpOnly refresh cookie and Bearer access", async (t) => {
  const fixture = await createAuthFixture(t);
  const base = await serve(
    t,
    createApp(
      { releaseId: "test", sourceSha: "test" },
      { db: fixture.pool, config: { ...fixture.config, cookieSecure: true }, clock: fixture.clock },
    ),
  );
  const headers = {
    Origin: "http://localhost:5173",
    "Content-Type": "application/json",
    "X-Bibi-Request": "1",
  };
  const login = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers,
    body: JSON.stringify({ username: "user01", password: fixture.secrets.userPassword }),
  });
  assert.equal(login.status, 200);
  const grant = await login.json();
  assert.ok(grant.accessToken);
  assert.equal(grant.refreshToken, undefined);
  const cookie = login.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /Secure/i);
  assert.match(cookie, /SameSite=Lax/i);
  assert.match(cookie, /Path=\/api\/auth/i);
  assert.doesNotMatch(cookie, /Domain=/i);
  assert.equal((await fetch(base + "/api/auth/profile")).status, 401);
  const profile = await fetch(base + "/api/auth/profile", {
    headers: { Authorization: `Bearer ${grant.accessToken}` },
  });
  assert.equal(profile.status, 200);
  assert.equal((await profile.json()).username, "user01");
  const refreshed = await fetch(base + "/api/auth/refresh", {
    method: "POST",
    headers: { ...headers, Cookie: cookie.split(";")[0] },
    body: "{}",
  });
  assert.equal(refreshed.status, 200);
  assert.notEqual(refreshed.headers.get("set-cookie").split(";")[0], cookie.split(";")[0]);
  const logout = await fetch(base + "/api/auth/logout", {
    method: "POST",
    headers: { ...headers, Cookie: refreshed.headers.get("set-cookie").split(";")[0] },
    body: "{}",
  });
  assert.equal(logout.status, 204);
  assert.match(logout.headers.get("set-cookie"), /Expires=Thu, 01 Jan 1970/i);
  assert.equal((await fetch(base + "/api/ready")).status, 200);
});

test("login rejects untrusted origin, unknown input fields and invalid credentials", async (t) => {
  const fixture = await createAuthFixture(t);
  const base = await serve(
    t,
    createApp(
      { releaseId: "test", sourceSha: "test" },
      { db: fixture.pool, config: fixture.config, clock: fixture.clock },
    ),
  );
  const headers = {
    Origin: "http://localhost:5173",
    "Content-Type": "application/json",
    "X-Bibi-Request": "1",
  };
  const input = { username: "admin", password: fixture.secrets.masterPassword };
  assert.equal(
    (
      await fetch(base + "/api/auth/login", {
        method: "POST",
        headers: { ...headers, Origin: "https://evil.example" },
        body: JSON.stringify(input),
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await fetch(base + "/api/auth/login", {
        method: "POST",
        headers,
        body: JSON.stringify({ ...input, isMaster: true }),
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await fetch(base + "/api/auth/login", {
        method: "POST",
        headers,
        body: JSON.stringify({ username: "admin", password: "wrong" }),
      })
    ).status,
    401,
  );
});
