import { createRequire } from "node:module";
import { mkdir, readFile, writeFile, cp } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { root } from "../../../scripts/runtime.mjs";
import {
  createContentMediaFixture,
  validDraft,
  validCategory,
} from "../../../backend/test/helpers/content.mjs";
import { setupLocalContent } from "../../../scripts/local-content.mjs";
import { localEnvironmentText } from "../../../scripts/local-env.mjs";
import { previewRelease } from "../../../scripts/preview.mjs";
import { startDevelopment } from "../../../scripts/dev.mjs";
import { prepareCountryDataset } from "../../../scripts/prepare-geoip.mjs";
import { makeManifest } from "../../../scripts/release-manifest.mjs";
import databaseMetadata from "../../../ops/database-metadata.cjs";
async function freePort() {
  const server = createServer();
  await new Promise((done, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", done);
  });
  const port = server.address().port;
  await new Promise((done) => server.close(done));
  return port;
}
/** All databases, files, PHP containers and processes belong to this disposable fixture. */
export async function createContentE2eFixture(t, { bundleDir, mode = "bridge" } = {}) {
  let app, closing;
  const close = () =>
    (closing ??= (async () => {
      await app?.close();
    })());
  t.after(close);
  const f = await createContentMediaFixture(t);
  f.clock.set(new Date());
  const grant = await f.auth.login({ username: "admin", password: f.secrets.masterPassword }),
    actor = await f.auth.authenticate(grant.accessToken);
  const directory = join(f.paths.root, "cms-e2e"),
    profileRoot = join(directory, "profiles");
  await mkdir(profileRoot, { recursive: true });
  const dataset = await prepareCountryDataset();
  const initialEnv = {
    DB_HOST: f.dbConfig.host,
    DB_PORT: String(f.dbConfig.port),
    DB_NAME: f.dbConfig.database,
    DB_USER: f.dbConfig.user,
    DB_PASSWORD: f.dbConfig.password,
    AUTH_JWT_SECRET: f.config.jwtSecret,
    AUTH_JWT_ISSUER: f.config.jwtIssuer,
    AUTH_JWT_AUDIENCE: f.config.jwtAudience,
    AUTH_ALLOWED_ORIGINS: "http://127.0.0.1:5173",
    ANALYTICS_ID_SECRET: randomBytes(32).toString("hex"),
    ANALYTICS_RELAY_SECRET: randomBytes(32).toString("base64url"),
    PROFILE_ASSET_DIR: profileRoot,
    GEOIP_COUNTRY_FILE: dataset.file,
  };
  const setup = await setupLocalContent({ pool: f.pool, env: initialEnv, directory, seed: false });
  let baseUrl, ownedPorts, backendRoot, restart;
  if (mode === "dev") {
    const ports = await Promise.all([freePort(), freePort(), freePort()]),
      envFile = join(directory, "dev.env"),
      env = {
        ...setup.env,
        NODE_ENV: "development",
        BIBI_PRIVATE_ENV_FILE: envFile,
        BIBI_CONTENT_ORIGIN: `http://127.0.0.1:${ports[0]}`,
        AUTH_ALLOWED_ORIGINS: `http://127.0.0.1:${ports[0]}`,
      };
    await writeFile(envFile, localEnvironmentText(env), { mode: 0o600, flag: "wx" });
    const start = async () => {
      const before = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
      Object.assign(process.env, env);
      try {
        app = await startDevelopment({
          frontendPort: ports[0],
          backendPort: ports[1],
          inspectorPort: ports[2],
          prebundle: false,
          cacheDir: join(directory, "vite-cache"),
        });
      } finally {
        for (const [key, value] of Object.entries(before)) {
          if (value === undefined) delete process.env[key];
          else process.env[key] = value;
        }
      }
    };
    await start();
    baseUrl = `http://127.0.0.1:${ports[0]}`;
    ownedPorts = [...ports, Number(new URL(app.relayUrl).port)];
    backendRoot = join(root, "backend");
    restart = async () => {
      await app.close();
      closing = undefined;
      await start();
      ownedPorts.splice(3, 1, Number(new URL(app.relayUrl).port));
    };
  } else {
    if (!bundleDir) {
      if (mode !== "bridge")
        throw Error("CMS acceptance requires a schema7 bundle from the release builder");
      bundleDir = join(directory, "bundle");
      await mkdir(join(bundleDir, "frontend/assets"), { recursive: true });
      await mkdir(join(bundleDir, "backend"));
      await writeFile(
        join(bundleDir, "frontend/index.html"),
        await readFile(join(root, "dist-cpanel/index.html")),
      );
      await cp(join(root, "dist-cpanel/assets"), join(bundleDir, "frontend/assets"), {
        recursive: true,
      });
      for (const name of [
        "dist",
        "migrations",
        "profile-migrations",
        "visitor-migrations",
        "visitor-context-migrations",
        "content-migrations",
        "relay",
      ])
        await cp(join(root, "backend", name), join(bundleDir, "backend", name), {
          recursive: true,
        });
      for (const name of ["package.json", "package-lock.json", "analytics-catalogue.json"])
        await cp(join(root, "backend", name), join(bundleDir, "backend", name));
      const manifest = makeManifest(
        "c".repeat(40),
        null,
        await databaseMetadata.createDatabaseMetadata(join(root, "backend")),
      );
      for (const file of ["manifest.json", "frontend/version.json"])
        await writeFile(join(bundleDir, file), JSON.stringify(manifest));
    }
    app = await previewRelease(bundleDir, { port: 0, runtimeEnv: setup.env });
    baseUrl = app.url;
    ownedPorts = [Number(new URL(baseUrl).port), Number(new URL(app.relayUrl).port)];
    backendRoot = join(bundleDir, "backend");
  }
  const require = createRequire(join(backendRoot, "package.json")),
    clock = { now: () => new Date() },
    sharp = require("sharp"),
    media = require(join(backendRoot, "dist/content/media/service.js")).createContentMedia({
      pool: f.pool,
      clock,
      paths: setup.paths,
    }),
    activeRead = async () =>
      (
        await require(
          join(backendRoot, "dist/content/publication/active-read.js"),
        ).readActiveContent(setup.paths)
      )?.snapshot ?? null,
    editing = require(join(backendRoot, "dist/content/editing.js")).createContentEditing({
      pool: f.pool,
      clock,
      paths: setup.paths,
      media,
      activeRead,
    }),
    publication = require(
      join(backendRoot, "dist/content/publication/publisher.js"),
    ).createContentPublication({
      pool: f.pool,
      clock,
      paths: setup.paths,
      media,
      assets: setup.assets,
      assetRoot: setup.env.BIBI_CONTENT_ASSET_ROOT,
      origin: baseUrl,
    });
  const login = async () => {
    const response = await fetch(baseUrl + "/api/auth/login", {
      method: "POST",
      headers: { Origin: baseUrl, "X-Bibi-Request": "1", "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: f.secrets.masterPassword }),
    });
    if (!response.ok) throw Error("Content fixture login failed");
    return (await response.json()).accessToken;
  };
  const publish = async (post, action = "publish") => {
    const job = await publication.request(actor, {
      action,
      targetId: post.id,
      expectedRevision: post.revision,
      idempotencyKey: randomUUID(),
    });
    await publication.reconcile();
    if ((await publication.status(actor, job.id)).status !== "succeeded")
      throw Error("Content fixture publication failed");
    return editing.get(actor, post.id);
  };
  let prepared;
  const preparePost = () =>
    (prepared ??= (async () => {
      const category = await editing.saveCategory(actor, null, validCategory(), null),
        job = await publication.request(actor, {
          action: "apply-category",
          targetId: category.id,
          expectedRevision: category.revision,
          idempotencyKey: randomUUID(),
        });
      await publication.reconcile();
      if ((await publication.status(actor, job.id)).status !== "succeeded")
        throw Error("Content fixture category publication failed");
      const bytes = await sharp({
          create: { width: 600, height: 400, channels: 3, background: "#c1a77b" },
        })
          .png()
          .toBuffer(),
        image = await media.upload(actor, {
          originalName: "fixture.png",
          mimeType: "image/png",
          bytes,
        });
      return { category, image, bytes };
    })());
  return {
    baseUrl,
    adminCredentials: { username: "admin", password: f.secrets.masterPassword },
    paths: setup.paths,
    ownedPorts,
    close,
    restart,
    login,
    pool: f.pool,
    editing,
    publication,
    actor,
    env: setup.env,
    createPost: async (patch) => {
      const { category, image } = await preparePost();
      return editing.saveDraft(
        actor,
        null,
        validDraft({
          ...patch,
          categoryId: category.id,
          coverMediaId: image.id,
          coverAlt: "Ảnh kiểm thử",
        }),
        null,
      );
    },
    preparePost,
    publish,
  };
}
