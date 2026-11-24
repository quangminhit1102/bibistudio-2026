import nodeTest from "node:test";
const test = (name, fn) => nodeTest(name, { timeout: 60000 }, fn);
import assert from "node:assert/strict";
import { createProfileFixture } from "./helpers/profiles.mjs";

const strong = "Mật khẩu mới 88";
async function fixture(t) {
  const f = await createProfileFixture(t);
  const change = (body, token = f.user.accessToken, origin = f.config.allowedOrigins[0]) =>
    fetch(f.base + "/api/profile/password", {
      method: "POST",
      headers: {
        Origin: origin,
        "X-Bibi-Request": "1",
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      body: JSON.stringify(body),
    });
  const self = (token) => f.request("/api/profile", "GET", undefined, token);
  const login = (username, password) => f.auth.login({ username, password });
  const row = async (username = "user01") =>
    (
      await f.pool.query(
        "SELECT id,password_hash,revision,auth_version FROM users WHERE username=?",
        [username],
      )
    )[0][0];
  return { ...f, change, self, login, row };
}

test("a user changes the password, keeps this session and loses the others", async (t) => {
  const f = await fixture(t),
    other = await f.login("user01", f.secrets.userPassword),
    before = await f.row();
  const changed = await f.change({ currentPassword: f.secrets.userPassword, newPassword: strong });
  assert.equal(changed.status, 200);
  const body = await changed.json();
  assert.equal(body.username, "user01");
  assert.equal(body.revision, before.revision + 1);
  assert.doesNotMatch(JSON.stringify(body), /password|hash/i);
  assert.equal((await f.self(f.user.accessToken)).status, 200);
  assert.equal((await f.self(other.accessToken)).status, 401);
  await assert.rejects(f.login("user01", f.secrets.userPassword));
  assert.ok((await f.login("user01", strong)).accessToken);
  const after = await f.row();
  assert.notEqual(after.password_hash, before.password_hash);
  assert.match(after.password_hash, /^\$2[aby]\$12\$/);
  assert.equal(after.auth_version, before.auth_version);
  const [sessions] = await f.pool.query(
    "SELECT revoked_at,revoke_reason FROM refresh_token_sessions WHERE user_id=? ORDER BY created_at",
    [before.id],
  );
  assert.deepEqual(
    sessions.filter((s) => s.revoked_at).map((s) => s.revoke_reason),
    ["password_changed"],
  );
  const [audit] = await f.pool.query("SELECT * FROM audit_logs");
  const event = audit.filter((a) => a.action === "profile.password_change");
  assert.equal(event.length, 1);
  assert.equal(event[0].actor_id, before.id);
  assert.equal(event[0].target_id, before.id);
  const metadata =
    typeof event[0].metadata === "string" ? JSON.parse(event[0].metadata) : event[0].metadata;
  assert.deepEqual(metadata, { sessionCount: 1 });
  const log = JSON.stringify(audit);
  for (const secret of [f.secrets.userPassword, strong, before.password_hash, after.password_hash])
    assert.ok(!log.includes(secret));
});

test("the master account changes its own password", async (t) => {
  const f = await fixture(t);
  const changed = await f.change(
    { currentPassword: f.secrets.masterPassword, newPassword: strong },
    f.master.accessToken,
  );
  assert.equal(changed.status, 200);
  assert.equal((await changed.json()).isMaster, true);
  assert.equal((await f.self(f.master.accessToken)).status, 200);
  await assert.rejects(f.login("admin", f.secrets.masterPassword));
  assert.ok((await f.login("admin", strong)).accessToken);
});

test("a wrong current password changes nothing", async (t) => {
  const f = await fixture(t),
    other = await f.login("user01", f.secrets.userPassword),
    before = await f.row();
  const refused = await f.change({ currentPassword: "Not-the-password!1", newPassword: strong });
  assert.equal(refused.status, 400);
  assert.equal((await refused.json()).error.code, "INVALID_CURRENT_PASSWORD");
  assert.deepEqual(await f.row(), before);
  assert.equal((await f.self(f.user.accessToken)).status, 200);
  assert.equal((await f.self(other.accessToken)).status, 200);
  assert.ok((await f.login("user01", f.secrets.userPassword)).accessToken);
});

test("the new password follows the account rule, is kept as typed and differs from the current one", async (t) => {
  const f = await fixture(t),
    current = f.secrets.userPassword,
    before = await f.row();
  for (const newPassword of ["short", "ấ".repeat(25), 12345678, null])
    assert.equal((await f.change({ currentPassword: current, newPassword })).status, 400);
  assert.deepEqual(await f.row(), before);
  const spaced = " mật khẩu ";
  assert.equal(spaced.length, 10);
  assert.equal((await f.change({ currentPassword: current, newPassword: spaced })).status, 200);
  await assert.rejects(f.login("user01", spaced.trim()));
  assert.ok((await f.login("user01", spaced)).accessToken);
});

test("the current password again, or an extra field, is refused", async (t) => {
  const f = await fixture(t),
    current = f.secrets.userPassword,
    before = await f.row();
  const same = await f.change({ currentPassword: current, newPassword: current });
  assert.equal(same.status, 400);
  assert.equal((await same.json()).error.code, "PASSWORD_UNCHANGED");
  for (const extra of [{ userId: f.master.profile.id }, { revision: 1 }, { username: "admin" }])
    assert.equal(
      (await f.change({ currentPassword: current, newPassword: strong, ...extra })).status,
      400,
    );
  assert.equal((await f.change({ newPassword: strong })).status, 400);
  assert.deepEqual(await f.row(), before);
});

test("origin and sign-in are required", async (t) => {
  const f = await fixture(t),
    body = { currentPassword: f.secrets.userPassword, newPassword: strong },
    before = await f.row();
  assert.equal((await f.change(body, f.user.accessToken, "https://invalid.example")).status, 403);
  assert.equal((await f.change(body, null)).status, 401);
  assert.deepEqual(await f.row(), before);
});

test("the sixth attempt in 15 minutes is refused, also with the right password", async (t) => {
  const f = await fixture(t),
    right = { currentPassword: f.secrets.userPassword, newPassword: strong };
  for (let i = 0; i < 5; i++)
    assert.equal(
      (await f.change({ ...right, currentPassword: "Wrong-password!" + i })).status,
      400,
    );
  const limited = await f.change(right);
  assert.equal(limited.status, 429);
  assert.equal((await limited.json()).error.code, "RATE_LIMITED");
  assert.ok(Number(limited.headers.get("retry-after")) > 0);
  // Another account on the same network is not held back by this one.
  assert.equal(
    (
      await f.change(
        { currentPassword: f.secrets.masterPassword, newPassword: strong },
        f.master.accessToken,
      )
    ).status,
    200,
  );
  f.clock.advance(15 * 60 * 1000 + 1000);
  const again = await f.login("user01", f.secrets.userPassword);
  assert.equal((await f.change(right, again.accessToken)).status, 200);
});

test("two changes at the same moment: one wins, the other is told the data changed", async (t) => {
  const f = await fixture(t),
    current = f.secrets.userPassword,
    candidates = ["Lần thứ nhất 11", "Lần thứ hai 22"];
  const results = await Promise.all(
    candidates.map((newPassword) => f.change({ currentPassword: current, newPassword })),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  const winner = candidates[results.findIndex((r) => r.status === 200)],
    loser = candidates.find((c) => c !== winner);
  assert.ok((await f.login("user01", winner)).accessToken);
  await assert.rejects(f.login("user01", loser));
});
