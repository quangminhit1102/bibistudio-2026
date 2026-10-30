import assert from "node:assert/strict";
import { test } from "node:test";
import { cp, mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { root } from "./runtime.mjs";
import { previewRelease } from "./preview.mjs";
import { makeManifest } from "./release-manifest.mjs";
test("compiled release preview serves FE, real BE, images and deep routes", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "bibi-preview-"));
  let app;
  t.after(async () => {
    await app?.close();
    await rm(dir, { recursive: true, force: true });
  });
  await mkdir(join(dir, "frontend/assets"), { recursive: true });
  await mkdir(join(dir, "backend"), { recursive: true });
  const m = makeManifest("a".repeat(40), "1");
  for (const name of ["manifest.json", "frontend/version.json"])
    await writeFile(join(dir, name), JSON.stringify(m));
  await writeFile(join(dir, "frontend/index.html"), "<html>BiBi preview</html>");
  await cp(join(root, "backend/dist"), join(dir, "backend/dist"), { recursive: true });
  for (const name of ["package.json", "package-lock.json"])
    await cp(join(root, "backend", name), join(dir, "backend", name));
  await mkdir(join(dir, "frontend/catalogue"));
  await cp(
    join(root, "public/catalogue/notebook-ca-phe.webp"),
    join(dir, "frontend/catalogue/image.webp"),
  );
  app = await previewRelease(dir, { port: 0 });
  assert.equal((await fetch(app.url + "/")).status, 200);
  const head = await fetch(app.url + "/", { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  assert.match(await (await fetch(app.url + "/products/example")).text(), /BiBi preview/);
  assert.deepEqual(await (await fetch(app.url + "/api/version")).json(), {
    releaseId: m.releaseId,
    sourceSha: m.sourceSha,
  });
  assert.equal((await fetch(app.url + "/api/missing")).status, 404);
  const image = await fetch(app.url + "/catalogue/image.webp");
  assert.equal(image.headers.get("content-type"), "image/webp");
  assert.ok((await image.arrayBuffer()).byteLength > 1000);
  assert.equal((await fetch(app.url + "/.env")).status, 404);
});
