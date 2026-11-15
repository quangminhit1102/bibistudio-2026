import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildContentAssets } from "./build-content-assets.mjs";
async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), "bibi-public-assets-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, ".vite"));
  await mkdir(join(dir, "assets"));
  for (const [file, body] of Object.entries({
    "blog-client-a.js": 'import "./transport-b.js";',
    "transport-b.js": "export const ready=true;",
    "journal-c.css": "body{color:#202020}",
    "font-d.woff2": "fixture-font",
  }))
    await writeFile(join(dir, "assets", file), body);
  const manifest = {
    "src/blog-client.ts": {
      file: "assets/blog-client-a.js",
      isEntry: true,
      imports: ["_transport"],
      css: ["assets/journal-c.css"],
      assets: ["assets/font-d.woff2"],
    },
    _transport: { file: "assets/transport-b.js" },
  };
  await writeFile(join(dir, ".vite/manifest.json"), JSON.stringify(manifest));
  return { dir, manifest };
}
test("public asset manifest includes the complete dedicated entry closure", async (t) => {
  const { dir } = await fixture(t),
    outputFile = join(dir, "public-assets.json"),
    result = await buildContentAssets({
      frontendDir: dir,
      outputFile,
      staticRoutes: [{ path: "/" }, { path: "/products" }],
    });
  assert.equal(result.schemaVersion, 1);
  assert.equal(result.script, "/assets/blog-client-a.js");
  assert.deepEqual(result.css, ["/assets/journal-c.css"]);
  assert.deepEqual(
    new Set(result.assets),
    new Set([
      "/assets/blog-client-a.js",
      "/assets/transport-b.js",
      "/assets/journal-c.css",
      "/assets/font-d.woff2",
    ]),
  );
  assert.deepEqual(JSON.parse(await readFile(outputFile, "utf8")), result);
});
test("public entry refuses admin editor closure and paths outside the frontend", async (t) => {
  const { dir, manifest } = await fixture(t);
  manifest._transport.file = "assets/admin-entry-b.js";
  await writeFile(join(dir, "assets/admin-entry-b.js"), "export const admin=true");
  await writeFile(join(dir, ".vite/manifest.json"), JSON.stringify(manifest));
  await assert.rejects(
    buildContentAssets({ frontendDir: dir, outputFile: join(dir, "a.json"), staticRoutes: [] }),
    /admin|public|forbidden/i,
  );
  manifest._transport.file = "../private.env";
  await writeFile(join(dir, ".vite/manifest.json"), JSON.stringify(manifest));
  await assert.rejects(
    buildContentAssets({ frontendDir: dir, outputFile: join(dir, "b.json"), staticRoutes: [] }),
    /path|asset|public|forbidden/i,
  );
});
test("a missing dedicated entry never uses the application's SPA entry", async (t) => {
  const { dir } = await fixture(t);
  await writeFile(
    join(dir, ".vite/manifest.json"),
    JSON.stringify({ "index.html": { file: "assets/main-a.js", isEntry: true } }),
  );
  await assert.rejects(
    buildContentAssets({ frontendDir: dir, outputFile: join(dir, "a.json"), staticRoutes: [] }),
    /dedicated|entry|blog/i,
  );
});
