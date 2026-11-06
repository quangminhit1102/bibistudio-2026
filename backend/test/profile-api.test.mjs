import test from "node:test";
import assert from "node:assert/strict";
import { resolve, join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createAuthFixture } from "./helpers/auth.mjs";
import { serve } from "./helpers/http.mjs";
import { createApp } from "../dist/app.js";
import { migrateProfiles } from "../dist/profile/schema.js";
const schemaDirectory = resolve("backend/profile-migrations");
async function fixture(t, { migrated = true, enabled = true } = {}) {
  const f = await createAuthFixture(t);
  if (migrated) await migrateProfiles(f.pool, schemaDirectory);
  const assetDirectory = await mkdtemp(join(tmpdir(), "bibi-profile-api-"));
  t.after(() => rm(assetDirectory, { recursive: true, force: true }));
  const base = await serve(
    t,
    createApp(
      { releaseId: "profile-test", sourceSha: "test" },
      {
        db: f.pool,
        config: f.config,
        clock: f.clock,
        ...(enabled ? { profiles: { schemaDirectory, assetDirectory } } : {}),
      },
    ),
  );
  const master = await f.auth.login({ username: "admin", password: f.secrets.masterPassword });
  async function request(
    path = "/api/profile",
    method = "GET",
    body,
    token = master.accessToken,
    origin = f.config.allowedOrigins[0],
  ) {
    const r = await fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Bibi-Request": "1",
        Origin: origin,
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: r.status, body: await r.json() };
  }
  return { ...f, base, master, request };
}
test("User-only and no-role users edit only their own metadata with stable authority and private audit", async (t) => {
  const f = await fixture(t),
    user = await f.auth.login({ username: "user01", password: f.secrets.userPassword });
  const read = await f.request("/api/profile", "GET", undefined, user.accessToken);
  assert.equal(read.status, 200);
  const before = read.body;
  const changed = await f.request(
    "/api/profile",
    "PATCH",
    {
      revision: before.revision,
      displayName: "Tên tự sửa",
      email: "self@example.test",
      phone: "0392 969 000",
    },
    user.accessToken,
  );
  assert.equal(changed.status, 200);
  assert.equal(changed.body.phone, "0392969000");
  assert.deepEqual(changed.body.roleIds, before.roleIds);
  assert.deepEqual(changed.body.permissions, ["customer_access.view"]);
  const refreshed = await f.auth.refresh(user.refreshToken);
  assert.equal(refreshed.profile.displayName, "Tên tự sửa");
  assert.equal(refreshed.profile.phone, "0392969000");
  const id = before.id;
  const [events] = await f.pool.query(
    "SELECT metadata FROM audit_logs WHERE action='profile.update' AND target_id=?",
    [id],
  );
  assert.equal(events.length, 1);
  const meta =
    typeof events[0].metadata === "string" ? JSON.parse(events[0].metadata) : events[0].metadata;
  assert.deepEqual(meta.changedFields.sort(), ["displayName", "email", "phone"]);
  assert.ok(!JSON.stringify(events).includes("self@example.test"));
  const noop = await f.request(
    "/api/profile",
    "PATCH",
    { revision: changed.body.revision, displayName: "Tên tự sửa" },
    refreshed.accessToken,
  );
  assert.equal(noop.body.revision, changed.body.revision);
  const [[auditCount]]=await f.pool.query("SELECT COUNT(*) n FROM audit_logs WHERE action='profile.update' AND target_id=?",[id]);
  assert.equal(auditCount.n,1);
  const created = await f.request("/api/accounts", "POST", {
    username: "norole",
    password: "Only-test-NoRole!88",
    displayName: "Không vai trò",
    roleIds: [],
  });
  assert.equal(created.status, 201);
  const noRole = await f.auth.login({ username: "norole", password: "Only-test-NoRole!88" });
  const self = await f.request(
    "/api/profile",
    "PATCH",
    { revision: created.body.revision, displayName: "Tự phục vụ" },
    noRole.accessToken,
  );
  assert.equal(self.status, 200);
  assert.deepEqual(self.body.permissions, []);
});
test("self API rejects escalation, wrong origin, Master, management and stale simultaneous revisions", async (t) => {
  const f = await fixture(t),
    user = await f.auth.login({ username: "user01", password: f.secrets.userPassword });
  const self = (await f.request("/api/profile", "GET", undefined, user.accessToken)).body;
  for (const [key, value] of Object.entries({
    id: f.master.profile.id,
    userId: f.master.profile.id,
    targetId: f.master.profile.id,
    roles: [],
    permissions: [],
    active: false,
    isMaster: true,
    username: "newname",
    password: "New-password!88",
    avatarId: "opaque",
  })) {
    assert.equal(
      (
        await f.request(
          "/api/profile",
          "PATCH",
          { revision: self.revision, [key]: value },
          user.accessToken,
        )
      ).status,
      400,
      key,
    );
  }
  assert.equal(
    (
      await f.request("/api/profile", "PATCH", {
        revision: f.master.profile.revision,
        displayName: "Forbidden",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await f.request(
        "/api/profile/" + f.master.profile.id,
        "PATCH",
        { revision: 1, displayName: "Forbidden" },
        user.accessToken,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await f.request(
        "/api/accounts/" + self.id,
        "PUT",
        { revision: self.revision, displayName: "Forbidden" },
        user.accessToken,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await f.request(
        "/api/profile",
        "PATCH",
        { revision: self.revision, displayName: "Wrong origin" },
        user.accessToken,
        "https://invalid.example",
      )
    ).status,
    403,
  );
  assert.equal((await f.request("/api/profile", "GET", undefined, null)).status, 401);
  const results = await Promise.all(
    ["Một", "Hai"].map((displayName) =>
      f.request(
        "/api/profile",
        "PATCH",
        { revision: self.revision, displayName },
        user.accessToken,
      ),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  const current = results.find((r) => r.status === 200).body;
  assert.equal(
    (
      await f.request(
        "/api/profile",
        "PATCH",
        { revision: current.revision, displayName: "   " },
        user.accessToken,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await f.request("/api/accounts/" + self.id + "/deactivate", "PATCH", {
        revision: current.revision,
      })
    ).status,
    200,
  );
  assert.equal((await f.request("/api/profile", "GET", undefined, user.accessToken)).status, 401);
});
test("enabled but unmigrated profile fails closed and disabled feature leaves legacy readiness usable", async (t) => {
  const missing = await fixture(t, { migrated: false });
  assert.equal((await missing.request("/api/profile")).status, 503);
  assert.equal((await fetch(missing.base + "/api/ready")).status, 503);
  const off = await fixture(t, { migrated: false, enabled: false });
  assert.equal((await off.request("/api/profile")).status, 503);
  assert.equal((await fetch(off.base + "/api/ready")).status, 200);
});
