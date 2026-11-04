import test from "node:test";
import assert from "node:assert/strict";
import { createAccountFixture } from "./helpers/accounts.mjs";

test("role CRUD validates permissions, protects Admin and rejects deletion of in-use roles", async (t) => {
  const { request, auth } = await createAccountFixture(t);
  const created = await request("/api/roles", "POST", {
    name: "Biên tập kiểm thử",
    description: "Vai trò mới",
  });
  assert.equal(created.status, 201);
  const id = created.body.id;
  const configured = await request(`/api/roles/${id}/permissions`, "PATCH", {
    revision: 1,
    permissionIds: ["customer_access.view", "account.view"],
  });
  assert.equal(configured.status, 200);
  assert.deepEqual(configured.body.permissionIds, ["account.view", "customer_access.view"]);
  assert.equal(
    (
      await request(`/api/roles/${id}/permissions`, "PATCH", {
        revision: 2,
        permissionIds: ["unknown.action"],
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(`/api/roles/${id}/permissions`, "PATCH", {
        revision: 2,
        permissionIds: ["account.view", "account.view"],
      })
    ).status,
    400,
  );
  const account = await request("/api/accounts", "POST", {
    username: "role-test",
    displayName: "Role test",
    password: "Only-test-Role!99",
    roleIds: [id],
  });
  assert.equal(account.status, 201);
  assert.equal((await request(`/api/roles/${id}`, "DELETE", { revision: 2 })).status, 409);
  const grant = await auth.login({ username: "role-test", password: "Only-test-Role!99" });
  assert.equal(
    (
      await request(`/api/roles/${id}/permissions`, "PATCH", {
        revision: 2,
        permissionIds: ["customer_access.view"],
      })
    ).status,
    200,
  );
  await assert.rejects(auth.authenticate(grant.accessToken), (error) => error.status === 401);
  assert.equal(
    (await request(`/api/roles/${id}`, "PUT", { revision: 3, name: "Đã sửa" })).status,
    200,
  );
  assert.equal(
    (await request(`/api/accounts/${account.body.id}/roles`, "PATCH", { revision: 1, roleIds: [] }))
      .status,
    200,
  );
  assert.equal((await request(`/api/roles/${id}`, "DELETE", { revision: 4 })).status, 204);
  for (const [path, method, body] of [
    ["/api/roles/system-admin", "PUT", { revision: 1, name: "Changed" }],
    ["/api/roles/system-admin", "DELETE", { revision: 1 }],
    ["/api/roles/system-admin/permissions", "PATCH", { revision: 1, permissionIds: [] }],
  ])
    assert.equal((await request(path, method, body)).status, 403);
  assert.equal(
    (await request("/api/roles", "POST", { name: "Smuggled", fullAccess: true })).status,
    400,
  );
});

test("non-fullAccess actors cannot self-escalate or grant permissions they do not hold", async (t) => {
  const { pool, auth, request } = await createAccountFixture(t);
  await pool.query(
    "INSERT INTO roles(id,name) VALUES ('limited-granter','Limited granter'),('other-role','Other role')",
  );
  for (const code of [
    "role.view",
    "role.update",
    "role.assign_permission",
    "account.assign_role",
    "account.create",
  ])
    await pool.execute(
      "INSERT INTO role_permissions(role_id,permission_id) VALUES ('limited-granter',?)",
      [code],
    );
  await pool.query(
    "INSERT INTO user_roles(user_id,role_id) SELECT id,'limited-granter' FROM users WHERE username='user01'",
  );
  const grant = await auth.login({ username: "user01", password: "Only-test-Auth!88" });
  assert.equal(
    (
      await request(
        "/api/roles/other-role/permissions",
        "PATCH",
        { revision: 1, permissionIds: ["account.delete"] },
        grant.accessToken,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        "/api/roles/limited-granter/permissions",
        "PATCH",
        { revision: 1, permissionIds: ["role.view"] },
        grant.accessToken,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        "/api/accounts",
        "POST",
        {
          username: "escalated",
          displayName: "Denied",
          password: "Only-test-Escalate!99",
          roleIds: ["system-admin"],
        },
        grant.accessToken,
      )
    ).status,
    403,
  );
  assert.equal((await request("/api/roles", "GET", undefined, grant.accessToken)).status, 200);
  assert.equal((await request("/api/roles/options")).status, 200);
  const permissions = await request("/api/permissions");
  assert.equal(permissions.status, 200);
  assert.ok(permissions.body.some((permission) => permission.code === "account.assign_role"));
});

test("permission changes revoke every affected multi-role user's sessions atomically", async (t) => {
  const { request, auth, pool } = await createAccountFixture(t);
  const role = await request("/api/roles", "POST", {
    name: "Multi-role test",
    permissionIds: ["product.view"],
  });
  assert.equal(role.status, 201);
  const accounts = [];
  for (const username of ["multi-one", "multi-two"]) {
    const account = await request("/api/accounts", "POST", {
      username,
      displayName: username,
      password: "Only-test-Multi!99",
      roleIds: ["system-user", role.body.id],
    });
    assert.equal(account.status, 201);
    accounts.push(await auth.login({ username, password: "Only-test-Multi!99" }));
  }
  assert.equal(
    (
      await request(`/api/roles/${role.body.id}/permissions`, "PATCH", {
        revision: 1,
        permissionIds: [],
      })
    ).status,
    200,
  );
  for (const account of accounts) {
    await assert.rejects(auth.authenticate(account.accessToken), (error) => error.status === 401);
    await assert.rejects(auth.refresh(account.refreshToken), (error) => error.status === 401);
    const [[sessions]] = await pool.execute(
      "SELECT COUNT(*) n FROM refresh_token_sessions WHERE user_id=? AND revoked_at IS NULL",
      [account.profile.id],
    );
    assert.equal(sessions.n, 0);
  }
});
