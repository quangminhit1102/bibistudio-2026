import { mkdtemp, mkdir, writeFile, readFile, rm, copyFile, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname, basename } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { createRequire } from "node:module";
const sharp = createRequire(new URL("../../backend/package.json", import.meta.url))("sharp");
import {
  makePublicAssets,
  makePublicSnapshot,
} from "../../backend/test/helpers/public-content.mjs";
import { createGenerationStore } from "../../backend/dist/content/publication/store.js";
import { renderContentGeneration } from "../../backend/dist/content/render/document.js";
import { withContentEnvironmentLock } from "../../backend/dist/content/environment-lock.js";
import { startPhpRelay } from "../php-relay.mjs";
export async function createReaderGenerations(t) {
  const temporary = await realpath(tmpdir()),
    root = await realpath(await mkdtemp(join(temporary, "bibi-reader-")));
  t.after(() => {
    if (dirname(root) !== temporary || !basename(root).startsWith("bibi-reader-"))
      throw Error("Unexpected reader fixture path");
    return rm(root, { recursive: true, force: true });
  });
  const paths = {
    root,
    media: join(root, "media"),
    generations: join(root, "generations"),
    active: join(root, "active"),
    deployLock: join(root, "deploy.lock"),
    managedRoots: [root],
    maxManagedBytes: 4 * 1024 ** 3,
    maxContentBytes: 1024 ** 3,
    maxGenerationBytes: 64 * 1024 ** 2,
    minHeadroomBytes: 256 * 1024 ** 2,
  };
  for (const dir of [paths.media, paths.generations, join(root, "assets"), join(root, "private")])
    await mkdir(dir, { mode: 0o700 });
  const assets = makePublicAssets();
  for (const file of assets.assets) await writeFile(join(root, file.slice(1)), "fixture");
  async function image(background) {
    const id = randomUUID(),
      bytes = await sharp({ create: { width: 480, height: 320, channels: 3, background } })
        .webp()
        .toBuffer(),
      hash = createHash("sha256").update(bytes).digest("hex"),
      file = id + "/" + hash + ".webp";
    await mkdir(join(paths.media, id));
    await writeFile(join(paths.media, file), bytes);
    return {
      id,
      variant: { hash, file, mime: "image/webp", bytes: bytes.length, width: 480, height: 320 },
    };
  }
  const photo = await image("#aabbcc"),
    draft = await image("#bbccdd"),
    one = makePublicSnapshot();
  one.media = { [photo.variant.file]: photo.variant };
  for (const [i, post] of one.posts.entries()) {
    post.coverMediaId = photo.id;
    post.mediaIds = [photo.id];
    post.html = "<p>generation-one-body</p>";
    if (i === 0) post.slug = "first";
  }
  one.redirects = { "/blog/old": "/blog/first" };
  const two = structuredClone(one);
  two.generationId = randomUUID();
  for (const post of two.posts) post.html = "<p>generation-two-body</p>";
  const empty = structuredClone(two);
  empty.generationId = randomUUID();
  empty.posts = [];
  empty.redirects = {};
  const store = createGenerationStore(paths, root);
  await withContentEnvironmentLock(paths, async (lease) => {
    for (const [snapshot, previous] of [
      [one, null],
      [two, one.generationId],
      [empty, one.generationId],
    ])
      await store.prepare(
        await renderContentGeneration(snapshot, assets, "https://bibistudio.vn", previous),
        lease,
      );
    await store.activate(one.generationId, null, lease);
  });
  return {
    paths,
    first: one.generationId,
    second: two.generationId,
    empty: empty.generationId,
    publicMedia: "/media/content/" + photo.variant.hash + ".webp",
    privateMedia: "/media/content/" + draft.variant.hash + ".webp",
    activate: (id, previous) =>
      withContentEnvironmentLock(paths, (lease) => store.activate(id, previous, lease)),
  };
}
export async function startContentReaderFixture(t, { paths, canonicalOrigin }) {
  await mkdir(join(paths.root, "private"), { recursive: true, mode: 0o700 });
  await writeFile(
    join(paths.root, "private/content-reader.json"),
    JSON.stringify({
      schemaVersion: 1,
      environment: "local",
      contentRoot: "/relay",
      canonicalOrigin,
    }),
    { mode: 0o600 },
  );
  await copyFile(
    new URL("../../ops/php/content-reader.php", import.meta.url),
    join(paths.root, "content-reader.php"),
  );
  const relayConfig = join(paths.root, "private/relay-fixture.json"),
    targetUrl = "http://127.0.0.1:3001/api/analytics/collect";
  await writeFile(relayConfig, JSON.stringify({ environment: "local", targetUrl }), {
    mode: 0o600,
  });
  const server = await startPhpRelay({
    targetUrl,
    configFile: relayConfig,
    sourceDirectory: paths.root,
    routerFile: resolve("scripts/test-helpers/content-reader-router.php"),
  });
  t.after(() => server.close());
  return { baseUrl: server.url };
}
