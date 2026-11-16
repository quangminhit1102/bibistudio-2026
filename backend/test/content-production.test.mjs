import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, cp, symlink, writeFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createContentFixture } from "./helpers/content.mjs";
import { buildContentSeed } from "../../scripts/build-content-seed.mjs";
import { localEnvironmentText } from "../../scripts/local-env.mjs";
test("CMS readiness fails closed for missing, corrupt and incompatible active content", async (t) => {
  const { createPublicationFixture } = await import("./helpers/content-publication.mjs"),
    { createRuntime } = await import("../dist/runtime.js"),
    { createApp } = await import("../dist/app.js"),
    { readRelease } = await import("../dist/release.js"),
    { serve } = await import("./helpers/http.mjs"),
    { prepareCountryDataset } = await import("../../scripts/prepare-geoip.mjs"),
    { randomBytes } = await import("node:crypto"),
    { rename } = await import("node:fs/promises");
  const f = await createPublicationFixture(t),
    profile = join(f.paths.root, "profiles"),
    release = join(f.paths.root, "release.json"),
    assets = join(f.paths.root, "content-assets.json"),
    dataset = await prepareCountryDataset();
  await mkdir(profile, { mode: 0o700 });
  await writeFile(assets, JSON.stringify(f.assets));
  await writeFile(
    release,
    JSON.stringify({
      releaseId: "local-readiness",
      sourceSha: "test",
      schemaVersion: 7,
      content: { mode: "cms", publicReaderVersion: 1 },
    }),
  );
  const env = {
    DB_HOST: f.dbConfig.host,
    DB_PORT: String(f.dbConfig.port),
    DB_NAME: f.dbConfig.database,
    DB_USER: f.dbConfig.user,
    DB_PASSWORD: f.dbConfig.password,
    AUTH_JWT_SECRET: f.config.jwtSecret,
    AUTH_ALLOWED_ORIGINS: f.config.allowedOrigins.join(","),
    ANALYTICS_ID_SECRET: randomBytes(32).toString("hex"),
    ANALYTICS_RELAY_SECRET: randomBytes(32).toString("base64url"),
    GEOIP_COUNTRY_FILE: dataset.file,
    PROFILE_ASSET_DIR: profile,
    BIBI_CONTENT_ROOT: f.paths.root,
    BIBI_CONTENT_MANAGED_ROOTS: JSON.stringify([f.paths.root]),
    BIBI_CONTENT_ASSET_ROOT: f.assetRoot,
    BIBI_CONTENT_ASSETS_FILE: assets,
    BIBI_RELEASE_MANIFEST: release,
  };
  const runtime = createRuntime(env, f.clock);
  t.after(() => runtime.close());
  const base = await serve(t, createApp(readRelease(env), runtime.appOptions));
  assert.equal((await fetch(base + "/api/ready")).status, 200);
  await rename(f.paths.active, f.paths.active + ".saved");
  assert.equal((await fetch(base + "/api/ready")).status, 503);
  await writeFile(f.paths.active, "corrupt pointer");
  assert.equal((await fetch(base + "/api/ready")).status, 503);
  await writeFile(
    f.paths.active,
    JSON.stringify({ schemaVersion: 2, generationId: "unsupported" }),
  );
  assert.equal((await fetch(base + "/api/ready")).status, 503);
  const bridgeRelease = join(f.paths.root, "bridge-release.json"),
    privateDir = join(f.paths.root, "private");
  await mkdir(privateDir, { mode: 0o700 });
  await writeFile(join(privateDir, "content-routing.json"), '{"schemaVersion":1}');
  await writeFile(
    bridgeRelease,
    JSON.stringify({
      releaseId: "local-bridge",
      sourceSha: "test",
      schemaVersion: 6,
      contentPublic: { readerVersion: 1, readModelVersion: 1 },
    }),
  );
  const bridgeEnv = {
      ...env,
      BIBI_PRIVATE_ENV_FILE: join(privateDir, "runtime.env"),
      BIBI_RELEASE_MANIFEST: bridgeRelease,
    },
    bridgeRuntime = createRuntime(bridgeEnv, f.clock);
  t.after(() => bridgeRuntime.close());
  const bridgeBase = await serve(t, createApp(readRelease(bridgeEnv), bridgeRuntime.appOptions));
  assert.equal((await fetch(bridgeBase + "/api/ready")).status, 503);
});
test(
  "compiled production seed uses the fixed private environment and packaged originals",
  { timeout: 240000 },
  async (t) => {
    const f = await createContentFixture(t),
      base = join(f.paths.root, "production"),
      backend = join(base, "app/backend"),
      content = join(base, "content"),
      privateDir = join(base, "private"),
      file = join(privateDir, "maintenance.env");
    for (const dir of [backend, join(content, "media"), join(content, "generations"), privateDir])
      await mkdir(dir, { recursive: true, mode: 0o700 });
    await cp(resolve("backend/dist"), join(backend, "dist"), { recursive: true });
    await cp(resolve("backend/content-migrations"), join(backend, "content-migrations"), {
      recursive: true,
    });
    await buildContentSeed({ outputDir: join(backend, "content-seed") });
    await symlink(
      resolve("backend/node_modules"),
      join(backend, "node_modules"),
      process.platform === "win32" ? "junction" : "dir",
    );
    await writeFile(
      file,
      localEnvironmentText({
        DB_HOST: f.dbConfig.host,
        DB_PORT: String(f.dbConfig.port),
        DB_NAME: f.dbConfig.database,
        DB_USER: f.dbConfig.user,
        DB_PASSWORD: f.dbConfig.password,
        BIBI_CONTENT_ROOT: content,
        BIBI_CONTENT_MANAGED_ROOTS: JSON.stringify([base]),
      }),
      { flag: "wx", mode: 0o600 },
    );
    const { stdout } = await promisify(execFile)(
      process.execPath,
      [join(backend, "dist/content/cli.js"), "seed"],
      {
        env: { ...process.env, NODE_ENV: "production", BIBI_PRIVATE_ENV_FILE: file },
        windowsHide: true,
        timeout: 180000,
      },
    );
    assert.deepEqual(JSON.parse(stdout.trim()), { created: 10, skipped: 0 });
    const [[rows]] = await f.pool.query("SELECT COUNT(*) n FROM content_posts");
    assert.equal(rows.n, 10);
    await assert.rejects(stat(join(content, "active")), { code: "ENOENT" });
  },
);
