import test from "node:test";
import assert from "node:assert/strict";
import { createAccountFixture } from "./helpers/accounts.mjs";
test("delegated password reset cannot take over full-access or higher-permission targets", async (t) => {
  const f = await createAccountFixture(t);
  await f.pool.query("INSERT INTO roles(id,name) VALUES ('limited-manager','Limited manager'),('higher-target','Higher target')");
  await f.pool.query("INSERT INTO role_permissions(role_id,permission_id) VALUES ('limited-manager','account.update'),('higher-target','role.create')");
  const create = async (username, roleIds) => {
    const result = await f.request("/api/accounts", "POST", { username, displayName: username, password: "Only-test-Initial!888", roleIds });
    assert.equal(result.status, 201); return result.body;
  };
  const manager = await create("limited_manager", ["limited-manager"]);
  const full = await create("ordinary_admin", ["system-admin"]);
  const higher = await create("higher_user", ["higher-target"]);
  const low = await create("lower_user", []);
  const grant = await f.auth.login({ username: manager.username, password: "Only-test-Initial!888" });
  for (const target of [full, higher]) {
    const reset = await f.request("/api/accounts/" + target.id, "PUT", { revision: target.revision, password: "Only-test-Attack!999" }, grant.accessToken);
    assert.equal(reset.status, 403);
    await f.auth.login({ username: target.username, password: "Only-test-Initial!888" });
    await assert.rejects(f.auth.login({ username: target.username, password: "Only-test-Attack!999" }));
  }
  assert.equal((await f.request("/api/accounts/" + low.id, "PUT", { revision: low.revision, password: "Only-test-Allowed!999" }, grant.accessToken)).status, 200);
  await f.auth.login({ username: low.username, password: "Only-test-Allowed!999" });
});
test("password reset checks live target permissions after a concurrent RBAC write", async (t) => {
  const f = await createAccountFixture(t);
  await f.pool.query("INSERT INTO roles(id,name) VALUES ('race-manager','Race manager'),('race-target','Race target')");
  await f.pool.query("INSERT INTO role_permissions(role_id,permission_id) VALUES ('race-manager','account.update')");
  const create = async (username, roleIds) => (await f.request("/api/accounts", "POST", {
    username, displayName: username, password: "Only-test-Race!888", roleIds,
  })).body;
  const manager = await create("race_manager", ["race-manager"]);
  const target = await create("race_target", ["race-target"]);
  const grant = await f.auth.login({ username: manager.username, password: "Only-test-Race!888" });
  const connection = await f.pool.getConnection();
  let pending;
  try {
    await connection.query("SELECT GET_LOCK(CONCAT('bibi-rbac:',LEFT(SHA2(DATABASE(),256),32)),10)");
    pending = f.request("/api/accounts/" + target.id, "PUT", { revision: target.revision, password: "Only-test-Takeover!999" }, grant.accessToken);
    await connection.beginTransaction();
    await connection.query("INSERT INTO role_permissions(role_id,permission_id) VALUES ('race-target','role.create')");
    await connection.execute("UPDATE users SET auth_version=auth_version+1 WHERE id=?", [target.id]);
    await connection.commit();
  } finally {
    await connection.query("SELECT RELEASE_LOCK(CONCAT('bibi-rbac:',LEFT(SHA2(DATABASE(),256),32)))");
    connection.release();
  }
  assert.equal((await pending).status, 403);
  await f.auth.login({ username: target.username, password: "Only-test-Race!888" });
});
