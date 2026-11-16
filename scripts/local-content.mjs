import { mkdir, writeFile, rename, realpath, lstat, mkdtemp, rm } from "node:fs/promises";
import { join, resolve, isAbsolute, dirname, basename } from "node:path";
import { randomUUID } from "node:crypto";
import { root } from "./runtime.mjs";
import { startLocalAnalyticsRelay } from "./local-analytics-relay.mjs";
import { buildContentAssets } from "./build-content-assets.mjs";
import { buildContentSeed } from "./build-content-seed.mjs";
import { readContentPaths, syncContentPermissions } from "../backend/dist/content/capabilities.js";
import { migrateContent } from "../backend/dist/content/schema.js";
import { readActiveContent } from "../backend/dist/content/publication/active-read.js";
import { createGenerationStore } from "../backend/dist/content/publication/store.js";
import { withContentEnvironmentLock } from "../backend/dist/content/environment-lock.js";
import { renderContentGeneration } from "../backend/dist/content/render/document.js";
import { publicContentCanary } from "../backend/dist/content/publication/publisher.js";
import { createContentMedia } from "../backend/dist/content/media/service.js";
import { importContentSeed } from "../backend/dist/content/seed.js";

export {
  isLocalContentPath,
  proxyLocalContent,
  serveLocalContentAsset,
} from "./local-content-proxy.mjs";
export async function startLocalContent({
  env = process.env,
  backendPort,
  frontendPort,
  contentRoot = env.BIBI_CONTENT_ROOT,
  signal,
  allowUninitialized = false,
  sourceDirectory,
  readerFile = join(root, "ops/php/content-reader.php"),
} = {}) {
  if (env.NODE_ENV === "production" || !contentRoot || !isAbsolute(contentRoot))
    throw Error("Explicit local content storage required");
  if (
    (await realpath(contentRoot)) !== resolve(contentRoot) ||
    (await lstat(contentRoot)).isSymbolicLink()
  )
    throw Error("Invalid local content root");
  const paths = readContentPaths({
    ...env,
    NODE_ENV: "development",
    BIBI_CONTENT_ROOT: contentRoot,
  });
  const active = await readActiveContent(paths);
  if (!active && !allowUninitialized)
    throw Error("Local content generation is uninitialized; run npm run db:setup:local");
  return startLocalAnalyticsRelay({
    env,
    backendPort,
    frontendPort,
    signal,
    sourceDirectory,
    content: {
      root: contentRoot,
      readerFile,
      origin: env.BIBI_CONTENT_ORIGIN ?? `http://127.0.0.1:${frontendPort}`,
    },
  });
}

export async function buildLocalContentAssets(directory) {
  const { build } = await import("vite");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const publicRoot = join(directory, "public"),
    output = join(directory, ".assets-" + randomUUID() + ".json");
  await build({
    configFile: join(root, "vite.blog.config.ts"),
    logLevel: "error",
    build: { outDir: publicRoot, emptyOutDir: false },
  });
  const assets = await buildContentAssets({ frontendDir: publicRoot, outputFile: output });
  const assetFile = join(directory, "content-assets.json");
  await rename(output, assetFile);
  return { assets, publicRoot, assetFile };
}
/** Called only by explicit setup. Daily dev/preview opens existing data without migrating/seeding. */
export async function setupLocalContent({
  pool,
  env,
  directory = join(root, ".superpowers/local-cms"),
  seed = true,
}) {
  if (env.NODE_ENV === "production" || !isAbsolute(directory))
    throw Error("Local content setup only");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  directory = await realpath(directory);
  const contentRoot = join(directory, "content"),
    releaseFile = join(directory, "release.json"),
    built = await buildLocalContentAssets(directory);
  const resultEnv = {
    ...env,
    BIBI_CONTENT_ROOT: contentRoot,
    BIBI_CONTENT_MANAGED_ROOTS: JSON.stringify([directory]),
    BIBI_CONTENT_ASSET_ROOT: built.publicRoot,
    BIBI_CONTENT_ASSETS_FILE: built.assetFile,
    BIBI_CONTENT_ORIGIN: env.BIBI_CONTENT_ORIGIN ?? "http://127.0.0.1:5173",
    BIBI_RELEASE_MANIFEST: releaseFile,
  };
  const paths = readContentPaths(resultEnv),
    clock = { now: () => new Date() };
  for (const path of [paths.root, paths.media, paths.generations])
    await mkdir(path, { recursive: true, mode: 0o700 });
  await writeFile(
    releaseFile,
    JSON.stringify({
      releaseId: "local-content-development",
      sourceSha: "local",
      schemaVersion: 7,
      content: { mode: "cms", publicReaderVersion: 1 },
    }),
    { mode: 0o600 },
  );
  await migrateContent(pool, join(root, "backend/content-migrations"));
  await syncContentPermissions(pool);
  if (seed) {
    const seedDirectory = await mkdtemp(join(directory, ".seed-"));
    try {
      await buildContentSeed({ outputDir: seedDirectory });
      await importContentSeed({
        pool,
        clock,
        media: createContentMedia({ pool, clock, paths }),
        seedDirectory,
      });
    } finally {
      if (
        dirname(resolve(seedDirectory)) !== directory ||
        !basename(seedDirectory).startsWith(".seed-")
      )
        throw Error("Unexpected local seed staging directory");
      await rm(seedDirectory, { recursive: true, force: true });
    }
  }
  if (!(await readActiveContent(paths))) {
    const php = await startLocalContent({
      env: resultEnv,
      backendPort: 3001,
      frontendPort: 5173,
      contentRoot,
      allowUninitialized: true,
    });
    try {
      await withContentEnvironmentLock(paths, async (lease) => {
        if (await readActiveContent(paths)) return;
        const snapshot = {
            schemaVersion: 1,
            generationId: randomUUID(),
            posts: [],
            categories: [],
            redirects: {},
            media: {},
            routes: [],
            committedAt: clock.now().toISOString(),
          },
          store = createGenerationStore(paths, built.publicRoot);
        await store.prepare(
          await renderContentGeneration(snapshot, built.assets, resultEnv.BIBI_CONTENT_ORIGIN),
          lease,
        );
        await store.activate(snapshot.generationId, null, lease);
        try {
          await publicContentCanary(paths, php.url, await readActiveContent(paths));
        } catch (error) {
          await store.restore(snapshot.generationId, null, lease);
          throw error;
        }
      });
    } finally {
      await php.close();
    }
  }
  return { env: resultEnv, paths, assets: built.assets };
}
