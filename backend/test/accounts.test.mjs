import test from "node:test";
import assert from "node:assert/strict";
import { createAccountFixture } from "./helpers/accounts.mjs";

test("account CRUD, revisions, activation and normalized username uniqueness use safe DTOs", async (t) => {
  const { request, auth } = await createAccountFixture(t);
  const created = await request("/api/accounts", "POST", {
    username: "MixedCase",
    displayName: "Khách kiểm thử",
    password: "Only-test-Account!99",
    roleIds: ["system-user"],
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.username, "mixedcase");
  assert.equal(created.body.email, null);
  assert.ok(!JSON.stringify(created.body).match(/password|auth_version|token_hash/));
  const id = created.body.id;
  assert.equal(
    (
      await request("/api/accounts", "POST", {
        username: "mixedcase",
        displayName: "Duplicate",
        password: "Only-test-Account!88",
        roleIds: [],
      })
    ).status,
    409,
  );
  const listed = await request("/api/accounts?search=mixedcase&page=1&pageSize=10");
  assert.equal(listed.status, 200);
  assert.equal(listed.body.total, 1);
  assert.equal(listed.body.items[0].id, id);
  assert.equal((await request("/api/accounts?pageSize=9999")).status, 400);
  const updated = await request(`/api/accounts/${id}`, "PUT", {
    revision: 1,
    displayName: "Đã sửa",
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.revision, 2);
  assert.equal(
    (await request(`/api/accounts/${id}`, "PUT", { revision: 1, displayName: "Stale" })).status,
    409,
  );
  const login = await auth.login({ username: "mixedcase", password: "Only-test-Account!99" });
  const inactive = await request(`/api/accounts/${id}/deactivate`, "PATCH", { revision: 2 });
  assert.equal(inactive.status, 200);
  assert.equal(inactive.body.active, false);
  await assert.rejects(auth.authenticate(login.accessToken), (error) => error.status === 401);
  await assert.rejects(auth.refresh(login.refreshToken), (error) => error.status === 401);
  assert.equal(
    (await request(`/api/accounts/${id}/activate`, "PATCH", { revision: 3 })).status,
    200,
  );
  assert.equal((await request(`/api/accounts/${id}`, "DELETE", { revision: 4 })).status, 204);
  assert.equal((await request(`/api/accounts/${id}`)).status, 404);
});

test("password and role changes revoke access immediately; own role assignment and field smuggling are rejected", async (t) => {
  const { request, auth, admin, pool } = await createAccountFixture(t);
  const [[user]] = await pool.query("SELECT id FROM users WHERE username='user01'");
  const grant = await auth.login({ username: "user01", password: "Only-test-Auth!88" });
  assert.equal(
    (
      await request(`/api/accounts/${user.id}`, "PUT", {
        revision: 1,
        password: "Only-test-New!77",
      })
    ).status,
    200,
  );
  await assert.rejects(auth.authenticate(grant.accessToken), (error) => error.status === 401);
  const next = await auth.login({ username: "user01", password: "Only-test-New!77" });
  assert.equal(
    (await request(`/api/accounts/${user.id}/roles`, "PATCH", { revision: 2, roleIds: [] })).status,
    200,
  );
  await assert.rejects(auth.refresh(next.refreshToken), (error) => error.status === 401);
  assert.equal(
    (
      await request(`/api/accounts/${user.id}`, "PUT", {
        revision: 3,
        active: true,
        isMaster: true,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(`/api/accounts/${admin.profile.id}/roles`, "PATCH", {
        revision: 1,
        roleIds: [],
      })
    ).status,
    403,
  );
});
