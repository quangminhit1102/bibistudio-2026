import { mkdtemp, mkdir, cp, writeFile, rm, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
export async function contentReleaseFixture(t) {
  const dir = await realpath(await mkdtemp(join(tmpdir(), "bibi-content-release-")));
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const name of [
    "backend/content-seed/images",
    "backend/content-public",
    "backend/dist/content/render",
    "frontend/assets",
  ])
    await mkdir(join(dir, name), { recursive: true });
  await cp(resolve("backend/content-migrations"), join(dir, "backend/content-migrations"), {
    recursive: true,
  });
  await cp(
    resolve("ops/php/content-reader.php"),
    join(dir, "backend/content-public/content-reader.php"),
  );
  await writeFile(join(dir, "backend/content-seed/manifest.json"), '{"fixture":true}');
  await writeFile(join(dir, "backend/content-seed/images/original.png"), "original fixture bytes");
  await writeFile(
    join(dir, "backend/dist/content/render/document.js"),
    "// compiled renderer fixture\n",
  );
  await writeFile(join(dir, "frontend/assets/blog-abc123.js"), "console.log('native fixture');");
  await writeFile(join(dir, "frontend/assets/blog-abc123.css"), "body{color:#111}");
  await writeFile(
    join(dir, "backend/content-assets.json"),
    JSON.stringify({
      schemaVersion: 1,
      rendererVersion: "content-doc-v1",
      css: ["/assets/blog-abc123.css"],
      script: "/assets/blog-abc123.js",
      assets: ["/assets/blog-abc123.css", "/assets/blog-abc123.js"],
      staticRoutes: [{ path: "/" }, { path: "/about" }],
    }),
  );
  return { dir, backend: join(dir, "backend"), frontend: join(dir, "frontend") };
}
export async function priorContentMetadata() {
  const b = resolve("backend");
  return Promise.all([
    require("../../ops/database-metadata.cjs").createDatabaseMetadata(b),
    require("../../ops/access-log-metadata.cjs").createAccessLogMetadata(b),
    require("../../ops/profile-metadata.cjs").createProfileMetadata(b),
    require("../../ops/visitor-metadata.cjs").createVisitorMetadata(b),
    require("../../ops/visitor-context-metadata.cjs").createVisitorContextMetadata(b),
  ]);
}
