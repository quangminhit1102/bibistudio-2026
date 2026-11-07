import nodeTest from "node:test";
const test = (name, fn) => nodeTest(name, { timeout: 25000 }, fn);
import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { createProfileFixture } from "./helpers/profiles.mjs";
import { pngImage, jpegImage } from "./helpers/avatar-images.mjs";
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => (resolve = done));
  return { promise, resolve };
};
test("avatar upload/read/replace/remove authorizes self and managers, keeps old assets private and immutable", async (t) => {
  const f = await createProfileFixture(t),
    image = pngImage();
  const first = await f.upload(image, 1);
  assert.equal(first.status, 200);
  const a = await first.json();
  assert.ok(a.avatarId);
  assert.equal(a.revision, 2);
  assert.ok(!JSON.stringify(a).includes(f.assetDirectory));
  const url = f.base + "/api/profile/avatar/" + a.avatarId;
  assert.equal((await fetch(url)).status, 401);
  const read = await fetch(url, { headers: { Authorization: "Bearer " + f.user.accessToken } });
  assert.equal(read.status, 200);
  assert.match(read.headers.get("content-type"), /^image\/png/);
  assert.match(read.headers.get("cache-control"), /no-store/);
  const other = f.base + "/api/accounts/" + f.master.profile.id + "/avatar/" + a.avatarId;
  assert.equal(
    (await fetch(other, { headers: { Authorization: "Bearer " + f.user.accessToken } })).status,
    403,
  );
  const manager = f.base + "/api/accounts/" + f.user.profile.id + "/avatar/" + a.avatarId;
  assert.equal(
    (await fetch(manager, { headers: { Authorization: "Bearer " + f.master.accessToken } })).status,
    200,
  );
  const second = await f.upload(jpegImage(), a.revision, { mime: "image/jpeg" });
  assert.equal(second.status, 200);
  const b = await second.json();
  assert.notEqual(b.avatarId, a.avatarId);
  assert.equal(
    (await fetch(url, { headers: { Authorization: "Bearer " + f.user.accessToken } })).status,
    404,
  );
  assert.equal((await readdir(f.assetDirectory)).length, 2);
  const removed = await fetch(f.base + "/api/profile/avatar", {
    method: "DELETE",
    headers: {
      Origin: f.config.allowedOrigins[0],
      "X-Bibi-Request": "1",
      "Content-Type": "application/json",
      Authorization: "Bearer " + f.user.accessToken,
      "If-Match": '"' + b.revision + '"',
    },
    body: "{}",
  });
  assert.equal(removed.status, 200);
  assert.equal((await removed.json()).avatarId, null);
  assert.equal((await readdir(f.assetDirectory)).length, 2);
  const [audit] = await f.pool.query(
    "SELECT action,metadata FROM audit_logs WHERE action LIKE 'profile.avatar.%'",
  );
  assert.equal(audit.length, 3);
  assert.ok(!JSON.stringify(audit).includes("bytes"));
  assert.ok(audit.every((row) => JSON.stringify(row.metadata).includes("assetIds")));
});
test("upload preconditions, Master protection, origin, body limits and shared actor rate limits", async (t) => {
  const f = await createProfileFixture(t),
    image = pngImage();
  assert.equal((await f.upload(image, undefined)).status, 428);
  assert.equal((await f.upload(image, 999)).status, 409);
  assert.equal(
    (await f.upload(Buffer.alloc(2097153), 1, { token: f.master.accessToken })).status,
    403,
  );
  assert.equal((await f.upload(image, 1, { origin: "https://invalid.example" })).status, 403);
  assert.equal((await f.upload(Buffer.alloc(2097153), 1)).status, 413);
  for (let i = 0; i < 9; i++) assert.equal((await f.upload(Buffer.from("broken"), 1)).status, 415);
  assert.equal((await f.upload(image, 1)).status, 429);
});
test("stale write after file creation removes only the new orphan and keeps the previous pointer", async (t) => {
  const wrote = deferred(),
    resume = deferred();
  let pause = false;
  const f = await createProfileFixture(t, {
    wrapStore: (store) => ({
      ...store,
      write: async (image) => {
        const file = await store.write(image);
        if (pause) {
          wrote.resolve();
          await resume.promise;
        }
        return file;
      },
    }),
  });
  const a = await (await f.upload(pngImage(), 1)).json();
  pause = true;
  const pending = f.upload(pngImage(30, 30), a.revision);
  await wrote.promise;
  const changed = await f.request(
    "/api/profile",
    "PATCH",
    { revision: a.revision, displayName: "Đổi đồng thời" },
    f.user.accessToken,
  );
  assert.equal(changed.status, 200);
  resume.resolve();
  assert.equal((await pending).status, 409);
  assert.equal((await readdir(f.assetDirectory)).length, 1);
  const self = await (await f.request("/api/profile", "GET", undefined, f.user.accessToken)).json();
  assert.equal(self.avatarId, a.avatarId);
});
test("lost commit acknowledgement retains the committed file and safe retry is a revision conflict", async (t) => {
  const f = await createProfileFixture(t),
    get = f.pool.getConnection.bind(f.pool);
  let injected = false;
  f.pool.getConnection = async () => {
    const c = await get(),
      execute = c.execute.bind(c),
      commit = c.commit.bind(c);
    let inserted = false;
    c.execute = async (sql, ...args) => {
      if (typeof sql === "string" && sql.startsWith("INSERT INTO profile_avatar_assets"))
        inserted = true;
      return execute(sql, ...args);
    };
    c.commit = async () => {
      await commit();
      if (inserted && !injected) {
        injected = true;
        throw new Error("controlled commit acknowledgement loss");
      }
    };
    return c;
  };
  assert.equal((await f.upload(pngImage(), 1)).status, 503);
  const self = await (await f.request("/api/profile", "GET", undefined, f.user.accessToken)).json();
  assert.ok(self.avatarId);
  assert.equal((await readdir(f.assetDirectory)).length, 1);
  assert.equal((await f.upload(pngImage(), 1)).status, 409);
  assert.equal(
    (
      await fetch(f.base + "/api/profile/avatar/" + self.avatarId, {
        headers: { Authorization: "Bearer " + f.user.accessToken },
      })
    ).status,
    200,
  );
});
for (const action of ["deactivate", "roles"])
  test(`session ${action} during staged upload prevents commit and cleans only its new file`, async (t) => {
    const wrote = deferred(),
      resume = deferred();
    const f = await createProfileFixture(t, {
      wrapStore: (store) => ({
        ...store,
        write: async (image) => {
          const file = await store.write(image);
          wrote.resolve();
          await resume.promise;
          return file;
        },
      }),
    });
    const pending = f.upload(pngImage(), 1);
    await wrote.promise;
    const changed = await f.request("/api/accounts/" + f.user.profile.id + "/" + action, "PATCH", {
      revision: 1,
      ...(action === "roles" ? { roleIds: [] } : {}),
    });
    assert.equal(changed.status, 200);
    resume.resolve();
    assert.equal((await pending).status, 401);
    assert.equal((await readdir(f.assetDirectory)).length, 0);
  });
test("disconnect before commit does not publish a staged avatar", async (t) => {
  const wrote = deferred(),
    resume = deferred(),
    closed = deferred(),
    cleaned = deferred();
  const f = await createProfileFixture(t, {
    observe: (req, res) => {
      if (req.method === "PUT")
        res.once("close", () => {
          if (!res.writableEnded) closed.resolve();
        });
    },
    wrapStore: (store) => ({
      ...store,
      write: async (image) => {
        const file = await store.write(image);
        wrote.resolve();
        await resume.promise;
        return file;
      },
      remove: async (...args) => {
        await store.remove(...args);
        cleaned.resolve();
      },
    }),
  });
  const controller = new AbortController(),
    pending = f.upload(pngImage(), 1, { signal: controller.signal });
  const rejected = assert.rejects(pending, (error) => error.name === "AbortError");
  await wrote.promise;
  controller.abort();
  await rejected;
  await closed.promise;
  resume.resolve();
  await cleaned.promise;
  const [[row]] = await f.pool.query("SELECT avatar_id FROM users WHERE id=?", [f.user.profile.id]);
  assert.equal(row.avatar_id, null);
});
test("rollback after asset insert preserves the old pointer and deletes only the staged file", async (t) => {
  const f = await createProfileFixture(t);
  const old = await (await f.upload(pngImage(), 1)).json();
  const get = f.pool.getConnection.bind(f.pool);
  let injected = false;
  f.pool.getConnection = async () => {
    const c = await get(),
      execute = c.execute.bind(c);
    c.execute = async (sql, ...args) => {
      const result = await execute(sql, ...args);
      if (
        !injected &&
        typeof sql === "string" &&
        sql.startsWith("INSERT INTO profile_avatar_assets")
      ) {
        injected = true;
        throw new Error("controlled precommit failure");
      }
      return result;
    };
    return c;
  };
  assert.equal((await f.upload(pngImage(), old.revision)).status, 503);
  const self = await (await f.request("/api/profile", "GET", undefined, f.user.accessToken)).json();
  assert.equal(self.avatarId, old.avatarId);
  assert.equal(self.revision, old.revision);
  assert.equal((await readdir(f.assetDirectory)).length, 1);
  const [[row]] = await f.pool.query("SELECT COUNT(*) n FROM profile_avatar_assets");
  assert.equal(row.n, 1);
});
for (const competing of ["replace", "remove"])
  test(`staged replacement loses cleanly to concurrent ${competing}`, async (t) => {
    const wrote = deferred(),
      resume = deferred();
    let pause = false;
    const f = await createProfileFixture(t, {
      wrapStore: (store) => ({
        ...store,
        write: async (image) => {
          const file = await store.write(image);
          if (pause) {
            pause = false;
            wrote.resolve();
            await resume.promise;
          }
          return file;
        },
      }),
    });
    const old = await (await f.upload(pngImage(), 1)).json();
    pause = true;
    const pending = f.upload(pngImage(20, 20), old.revision);
    await wrote.promise;
    let winner;
    if (competing === "replace")
      winner = await f.upload(jpegImage(), old.revision, { mime: "image/jpeg" });
    else
      winner = await fetch(f.base + "/api/profile/avatar", {
        method: "DELETE",
        headers: {
          Origin: f.config.allowedOrigins[0],
          "X-Bibi-Request": "1",
          Authorization: "Bearer " + f.user.accessToken,
          "If-Match": '"' + old.revision + '"',
        },
      });
    assert.equal(winner.status, 200);
    const saved = await winner.json();
    resume.resolve();
    assert.equal((await pending).status, 409);
    const self = await (
      await f.request("/api/profile", "GET", undefined, f.user.accessToken)
    ).json();
    assert.equal(self.avatarId, saved.avatarId);
    assert.equal((await readdir(f.assetDirectory)).length, competing === "replace" ? 2 : 1);
  });
test("retained avatar quota rejects upload before decode", async (t) => {
  const f = await createProfileFixture(t);
  await f.pool.query(
    "INSERT INTO profile_avatar_assets(id,user_id,format,width,height,bytes,sha256,created_at) SELECT UUID(),?,'png',1,1,1,REPEAT('a',64),NOW(3) FROM information_schema.columns LIMIT 128",
    [f.user.profile.id],
  );
  const response = await f.upload(Buffer.from("not an image"), 1);
  assert.equal(response.status, 429);
  assert.equal((await response.json()).error.code, "AVATAR_QUOTA_EXCEEDED");
  assert.equal((await readdir(f.assetDirectory)).length, 0);
});

test("bounded JSON image envelope works beyond global JSON limit and retains avatar authorization", async (t) => {
  const f = await createProfileFixture(t),
    image = pngImage(2000, 2000);
  const put = (body, token = f.user.accessToken, rev = 1, path = "/api/profile/avatar") =>
    fetch(f.base + path, {
      method: "PUT",
      headers: {
        Origin: f.config.allowedOrigins[0],
        "X-Bibi-Request": "1",
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
        "If-Match": JSON.stringify(String(rev)),
      },
      body: JSON.stringify(body),
    });
  assert.ok(image.length > 16384);
  const r = await put({ mimeType: "image/png", data: image.toString("base64") });
  assert.equal(r.status, 200);
  let saved = await r.json();
  assert.ok(saved.avatarId);
  assert.equal(
    (
      await put(
        { mimeType: "image/png", data: image.toString("base64") },
        f.user.accessToken,
        1,
        "/api/accounts/" + f.master.profile.id + "/avatar",
      )
    ).status,
    403,
  );
  const managed = await put(
    { mimeType: "image/png", data: image.toString("base64") },
    f.master.accessToken,
    saved.revision,
    "/api/accounts/" + f.user.profile.id + "/avatar",
  );
  assert.equal(managed.status, 200);
  saved = await managed.json();
  assert.equal(
    (await put({ mimeType: "image/png", data: "YWJj!!" }, undefined, saved.revision)).status,
    400,
  );
  assert.equal(
    (
      await put(
        { mimeType: "image/png", data: Buffer.alloc(2097153).toString("base64") },
        undefined,
        saved.revision,
      )
    ).status,
    413,
  );
  assert.equal(
    (
      await put(
        { mimeType: "image/png", data: image.toString("base64"), extra: true },
        undefined,
        saved.revision,
      )
    ).status,
    400,
  );
  assert.equal(
    (await put({ mimeType: "image/png", data: image.toString("base64") }, f.master.accessToken))
      .status,
    403,
  );
  const other = await f.request(
    "/api/profile",
    "PATCH",
    { revision: saved.revision, displayName: "Changed" },
    f.user.accessToken,
  );
  assert.equal(other.status, 200);
  assert.equal(
    (
      await put(
        { mimeType: "image/png", data: image.toString("base64") },
        undefined,
        saved.revision,
      )
    ).status,
    409,
  );
});
