import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../dist/app.js";
import { serve } from "./helpers/http.mjs";
import {
  createCatalogue,
  mergePublishedCatalogue,
  publicPath,
} from "../dist/visitors/catalogue.js";
import { makePublicSnapshot } from "./helpers/public-content.mjs";
import { createPublicationFixture, publicationRequest } from "./helpers/content-publication.mjs";
import { createRuntime } from "../dist/runtime.js";
import { runNextPublication } from "../dist/content/publication/worker.js";
import { collectVisitor } from "../dist/visitors/collector.js";
import { sessionDtos } from "../dist/visitors/session-history.js";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { createAuthFixture } from "./helpers/auth.mjs";
async function client(t, source) {
  const base = await serve(
    t,
    createApp({ releaseId: "public-fixture", sourceSha: "test" }, { publicContent: source }),
  );
  return async (path, status) => {
    const response = await fetch(base + path);
    assert.equal(response.status, status);
    return { body: await response.json(), headers: Object.fromEntries(response.headers) };
  };
}
const base = createCatalogue({
  version: 1,
  routes: [
    { path: "/", label: "Home" },
    { path: "/blog/old", label: "Old" },
    { path: "/products/a", label: "A" },
  ],
  products: [{ slug: "a", name: "A" }],
});
test("published routes extend the analytics allowlist without prefix trust", () => {
  const merged = mergePublishedCatalogue(base, {
    routes: [{ path: "/blog/new-article", label: "New" }],
    products: [],
  });
  assert.equal(publicPath("/blog/new-article", merged), "/blog/new-article");
  for (const path of ["/blog/not-published", "/blog/old", "/admin/preview"])
    assert.equal(publicPath(path, merged), undefined);
  assert.deepEqual(merged.products, base.products);
  assert.equal(publicPath("/products/a", merged), "/products/a");
});
test("a bridge exposes fresh authorized read-only capabilities before the content schema exists", async (t) => {
  const f = await createAuthFixture(t),
    base = await serve(
      t,
      createApp(
        { releaseId: "bridge", sourceSha: "test", schemaVersion: 6 },
        { db: f.pool, config: f.config, clock: f.clock },
      ),
    );
  const grant = await f.auth.login({ username: "user01", password: f.secrets.userPassword }),
    headers = { Authorization: "Bearer " + grant.accessToken };
  await f.pool.execute(
    "INSERT IGNORE INTO role_permissions(role_id,permission_id) SELECT role_id,'post.view' FROM user_roles WHERE user_id=(SELECT id FROM users WHERE username='user01')",
  );
  const response = await fetch(base + "/api/content/capabilities", { headers });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    mode: "bridge",
    publicReaderVersion: 1,
    canWrite: false,
  });
  assert.equal((await fetch(base + "/api/content/posts", { method: "POST", headers })).status, 503);
  await f.pool.execute(
    "DELETE rp FROM role_permissions rp JOIN user_roles ur ON ur.role_id=rp.role_id JOIN users u ON u.id=ur.user_id WHERE u.username='user01' AND rp.permission_id='post.view'",
  );
  assert.equal((await fetch(base + "/api/content/capabilities", { headers })).status, 403);
});
test("public API reads only the active snapshot and changes with the pointer", async (t) => {
  let snapshot = makePublicSnapshot({ postCount: 2 });
  const get = await client(t, {
    activeRead: async () => snapshot,
    legacyAllowed: async () => false,
  });
  const first = await get("/api/public/content/posts", 200);
  assert.equal(first.body.generationId, snapshot.generationId);
  assert.equal(first.headers["cache-control"], "no-store");
  await get("/api/public/content/posts/unknown-draft", 404);
  const old = snapshot.posts[0].slug;
  snapshot = makePublicSnapshot({ postCount: 1 });
  snapshot.posts[0].slug = "new-article";
  snapshot.routes = [{ path: "/blog/new-article", label: "New" }];
  await get("/api/public/content/posts/" + old, 404);
  await get("/api/public/content/posts/new-article", 200);
  assert.deepEqual((await get("/api/public/content/routes", 200)).body.routes, snapshot.routes);
});
test("only explicit pre-cutover legacy mode is allowed; marker and errors fail closed", async (t) => {
  let marker = false,
    fail = false;
  const get = await client(t, {
    activeRead: async () => {
      if (fail) throw Error("private path detail");
      return null;
    },
    legacyAllowed: async () => !marker,
  });
  assert.equal((await get("/api/public/content/routes", 200)).body.mode, "legacy");
  await get("/api/public/content/posts", 503);
  marker = true;
  await get("/api/public/content/routes", 503);
  marker = false;
  fail = true;
  const response = await get("/api/public/content/routes", 503);
  assert.doesNotMatch(JSON.stringify(response.body), /private path detail/);
});
test("compiled bridge runtime follows real publications without rebuilding and retains stored history", async (t) => {
  const f = await createPublicationFixture(t),
    idSecret = randomBytes(32).toString("hex"),
    privateDirectory = join(f.paths.root, "private");
  await mkdir(privateDirectory);
  const runtime = createRuntime(
    {
      DB_HOST: f.dbConfig.host,
      DB_PORT: String(f.dbConfig.port),
      DB_USER: f.dbConfig.user,
      DB_PASSWORD: f.dbConfig.password,
      DB_NAME: f.dbConfig.database,
      AUTH_JWT_SECRET: f.config.jwtSecret,
      AUTH_ALLOWED_ORIGINS: "http://localhost:5173",
      ANALYTICS_ID_SECRET: idSecret,
      BIBI_CONTENT_ROOT: f.paths.root,
      BIBI_PRIVATE_ENV_FILE: join(privateDirectory, "app.env"),
    },
    f.clock,
  );
  t.after(() => runtime.close());
  assert.equal(await runtime.appOptions.publicContent.legacyAllowed(), true);
  await writeFile(join(privateDirectory, "content-routing.json"), "{}");
  assert.equal(await runtime.appOptions.publicContent.legacyAllowed(), false);
  const post = await f.makePost("brand-new-cms-post"),
    path = "/blog/" + post.slug;
  assert.equal(publicPath(path, await runtime.appOptions.analytics.readCatalogue()), undefined);
  const job = await f.publication.request(f.admin, publicationRequest(post));
  await runNextPublication(f.context);
  assert.equal((await f.publication.status(f.admin, job.id)).status, "succeeded");
  const active = await runtime.appOptions.analytics.readCatalogue();
  assert.equal(publicPath(path, active), path);
  assert.equal(publicPath("/blog/a-private-draft", active), undefined);
  assert.equal(active.products.size > 0, true);
  const input = { paths: [path, "/blog/a-private-draft"], products: [], lastPath: path },
    context = {
      ip: "192.0.2.123",
      userAgent: "Mozilla/5.0 Chrome/123.0",
      now: f.clock.now(),
      idSecret,
      catalogue: active,
    };
  const bootstrap = await collectVisitor(f.pool, input, context);
  assert.equal(bootstrap.status, 202);
  assert.equal(
    (await collectVisitor(f.pool, input, { ...context, cookie: bootstrap.cookie.value })).status,
    204,
  );
  const unpublish = await f.publication.request(f.admin, {
    action: "unpublish",
    targetId: post.id,
    expectedRevision: post.revision,
    idempotencyKey: randomUUID(),
  });
  await runNextPublication(f.context);
  assert.equal((await f.publication.status(f.admin, unpublish.id)).status, "succeeded");
  const next = await runtime.appOptions.analytics.readCatalogue();
  assert.equal(publicPath(path, next), undefined);
  const [rows] = await f.pool.query("SELECT * FROM visitor_sessions");
  const history = await sessionDtos(f.pool, next, rows);
  assert.deepEqual(
    history.flatMap((session) => session.pages.map((page) => page.path)),
    [path],
  );
  await unlink(f.paths.active);
  const get = await client(t, runtime.appOptions.publicContent);
  await get("/api/public/content/routes", 503);
  assert.equal(publicPath(path, await runtime.appOptions.analytics.readCatalogue()), undefined);
});
