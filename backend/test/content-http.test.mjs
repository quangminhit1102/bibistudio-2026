import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../dist/app.js";
import { serve } from "./helpers/http.mjs";
import { fileURLToPath } from "node:url";
import { createContentEditingFixture, validDraft, validCategory } from "./helpers/content.mjs";
import { createPublicationFixture, publicationRequest } from "./helpers/content-publication.mjs";
import { runNextPublication } from "../dist/content/publication/worker.js";
import { readActiveContent } from "../dist/content/publication/active-read.js";

test("HTTP queues an exact revision and authenticated polling observes the durable result", async (t) => {
  const f = await createPublicationFixture(t),
    post = await f.makePost("http-post"),
    base = await serve(
      t,
      createApp(
        {
          releaseId: "fixture",
          sourceSha: "test",
          schemaVersion: 7,
          content: { mode: "cms", publicReaderVersion: 1 },
        },
        {
          db: f.pool,
          config: f.config,
          clock: f.clock,
          content: {
            paths: f.paths,
            schemaDirectory: fileURLToPath(new URL("../content-migrations", import.meta.url)),
            activeRead: async () => (await readActiveContent(f.paths))?.snapshot ?? null,
            publication: f.publication,
          },
        },
      ),
    ),
    grant = await f.auth.login({ username: "admin", password: f.secrets.masterPassword }),
    headers = {
      Origin: f.config.allowedOrigins[0],
      "X-Bibi-Request": "1",
      "Content-Type": "application/json",
      Authorization: "Bearer " + grant.accessToken,
    };
  const response = await fetch(base + "/api/content/publications", {
    method: "POST",
    headers,
    body: JSON.stringify(publicationRequest(post)),
  });
  assert.equal(response.status, 202);
  const job = await response.json();
  assert.equal(job.status, "queued");
  assert.equal((await fetch(base + "/api/content/publications/" + job.id)).status, 401);
  await runNextPublication(f.context);
  const poll = await fetch(base + "/api/content/publications/" + job.id, { headers });
  assert.equal(poll.status, 200);
  assert.equal((await poll.json()).status, "succeeded");
  assert.match(poll.headers.get("cache-control"), /no-store/);
});
async function fixture(t, mode = "cms") {
  const f = await createContentEditingFixture(t),
    release = { ...f.release, content: { ...f.release.content, mode } },
    app = createApp(release, {
      db: f.pool,
      config: f.config,
      clock: f.clock,
      content: {
        paths: f.paths,
        schemaDirectory: fileURLToPath(new URL("../content-migrations", import.meta.url)),
        activeRead: f.activeRead,
      },
    }),
    base = await serve(t, app),
    tokens = {};
  for (const username of ["admin", "editor", "viewer"])
    tokens[username] = (
      await f.auth.login({
        username,
        password: username === "admin" ? f.secrets.masterPassword : f.secrets.userPassword,
      })
    ).accessToken;
  const request = (path, method = "GET", body, actor = "editor") =>
    fetch(base + path, {
      method,
      headers: {
        Origin: f.config.allowedOrigins[0],
        "X-Bibi-Request": "1",
        "Content-Type": "application/json",
        ...(actor ? { Authorization: "Bearer " + tokens[actor] } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  return { ...f, request };
}

test("HTTP creates and reloads a shared draft beyond the old global16KiB parser", async (t) => {
  const f = await fixture(t),
    input = validDraft({ content: "x".repeat(18000) }),
    response = await f.request("/api/content/posts", "POST", { input });
  assert.equal(response.status, 201);
  const post = await response.json();
  const loaded = await f.request(`/api/content/posts/${post.id}`);
  assert.equal(loaded.status, 200);
  assert.equal((await loaded.json()).title, input.title);
  assert.equal(
    (
      await f.request(`/api/content/posts/${post.id}`, "PUT", {
        input: { ...input, title: "New" },
        expectedRevision: post.revision,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await f.request(`/api/content/posts/${post.id}`, "PUT", {
        input: { ...input, title: "Stale" },
        expectedRevision: post.revision,
      })
    ).status,
    409,
  );
});

test("authors/tags/choices expose only minimal paged data and bridge never accepts writes", async (t) => {
  const f = await fixture(t),
    authors = await (await f.request("/api/content/authors?page=1&pageSize=100")).json();
  assert.ok(authors.items.length);
  assert.ok(authors.items.every((item) => Object.keys(item).sort().join() === "id,kind,name"));
  assert.doesNotMatch(JSON.stringify(authors), /password|email|phone|refreshToken/);
  const bridge = await fixture(t, "bridge");
  assert.equal(
    (await bridge.request("/api/content/posts", "POST", { input: validDraft() })).status,
    503,
  );
  const caps = await (await bridge.request("/api/content/capabilities")).json();
  assert.equal(caps.mode, "bridge");
  assert.equal(caps.canWrite, false);
});

test("anonymous and unauthorized content mutations reject before parsing large input", async (t) => {
  const f = await fixture(t),
    body = { input: validDraft({ content: "x".repeat(524289) }) };
  assert.equal((await f.request("/api/content/posts", "POST", body, null)).status, 401);
  assert.equal((await f.request("/api/content/posts", "POST", body, "viewer")).status, 403);
  assert.equal((await f.request("/api/content/posts", "POST", body, "editor")).status, 413);
});

test("lookup pagination keeps authors beyond100 and supplies category ancestors for search", async (t) => {
  const f = await fixture(t);
  for (let i = 0; i < 105; i++)
    await f.pool.execute(
      "INSERT INTO users(id,username,display_name,password_hash) SELECT UUID(),?,?,password_hash FROM users WHERE username='user01'",
      ["author" + i, "Author " + String(i).padStart(3, "0")],
    );
  const first = await (await f.request("/api/content/authors?page=1&pageSize=100")).json(),
    second = await (await f.request("/api/content/authors?page=2&pageSize=100")).json();
  assert.ok(second.items.length > 0);
  assert.equal(new Set([...first.items, ...second.items].map((item) => item.id)).size, first.total);
  const root = await f.editing.saveCategory(
    f.admin,
    null,
    {
      name: "Root",
      slug: "root",
      description: "",
      parentId: null,
      position: 0,
      active: true,
      seoTitle: "",
      seoDescription: "",
    },
    null,
  );
  const child = await f.editing.saveCategory(
    f.admin,
    null,
    validCategory({ name: "Find child", slug: "find-child", parentId: root.id }),
    null,
  );
  const choices = await (
    await f.request("/api/content/category-choices?page=1&pageSize=1&search=Find")
  ).json();
  assert.equal(choices.items[0].id, child.id);
  assert.equal(choices.ancestors[0].id, root.id);
});

test("category-only viewers can read release capabilities", async (t) => {
  const f = await fixture(t),
    [[role]] = await f.pool.execute("SELECT role_id FROM user_roles WHERE user_id=?", [
      f.viewer.principal.id,
    ]);
  await f.pool.execute("DELETE FROM role_permissions WHERE role_id=?", [role.role_id]);
  await f.pool.execute(
    "INSERT INTO role_permissions(role_id,permission_id) VALUES(?,'content_category.view')",
    [role.role_id],
  );
  assert.equal(
    (await f.request("/api/content/capabilities", "GET", undefined, "viewer")).status,
    200,
  );
});
