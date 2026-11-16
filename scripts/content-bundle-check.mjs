import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { isMain } from "./runtime.mjs";
import { validateBundle } from "./build.mjs";
import { previewRelease } from "./preview.mjs";
import { createContentE2eFixture } from "../tests/e2e/helpers/content-fixture.mjs";
import { postInput } from "../backend/test/helpers/content-publication.mjs";
import { assertPortsFree } from "./process-group.mjs";

export async function contentBundleAcceptance({ bridgeDir, cmsDir }) {
  return test(
    "actual compiled CMS to bridge to CMS retains newer public content and disables bridge writes",
    { timeout: 180000 },
    async (t) => {
      for (const [dir, mode] of [
        [bridgeDir, "bridge"],
        [cmsDir, "cms"],
      ]) {
        const manifest = await validateBundle(dir);
        assert.equal(manifest.schemaVersion, mode === "cms" ? 7 : 6);
        assert.equal(!!manifest.content, mode === "cms");
        if (mode === "bridge") assert.equal(manifest.contentPublic.readerVersion, 1);
        const bytes = await readFile(dir + ".tgz");
        assert.equal(
          (await readFile(dir + ".tgz.sha256", "utf8")).trim(),
          createHash("sha256").update(bytes).digest("hex"),
        );
      }
      const f = await createContentE2eFixture(t, { bundleDir: cmsDir, mode: "cms" }),
        post = await f.createPost({ slug: "compiled-new-content", title: "Bản công khai đầu" });
      await f.publish(post);
      assert.match(
        await (await fetch(f.baseUrl + "/blog/compiled-new-content")).text(),
        /<h1[^>]*>Bản công khai đầu<\/h1>/,
      );
      const port = Number(new URL(f.baseUrl).port);
      await f.close();
      const bridge = await previewRelease(bridgeDir, { port, runtimeEnv: f.env });
      t.after(() => bridge.close());
      assert.equal((await fetch(f.baseUrl + "/api/ready")).status, 200);
      const token = await f.login(),
        headers = {
          Authorization: "Bearer " + token,
          Origin: f.baseUrl,
          "X-Bibi-Request": "1",
          "Content-Type": "application/json",
        };
      assert.equal(
        (
          await fetch(f.baseUrl + "/api/content/posts", {
            method: "POST",
            headers,
            body: JSON.stringify({ input: {} }),
          })
        ).status,
        503,
      );
      // Exercise an external operator using the currently installed compiled code.
      // A closed local preview removes its own dependency junction; production keeps
      // dependencies installed, so don't reuse workers from that closed fixture.
      const require = createRequire(resolve(bridgeDir, "backend/package.json")),
        clock = { now: () => new Date() },
        media = require(
          resolve(bridgeDir, "backend/dist/content/media/service.js"),
        ).createContentMedia({ pool: f.pool, clock, paths: f.paths }),
        activeRead = async () =>
          (
            await require(
              resolve(bridgeDir, "backend/dist/content/publication/active-read.js"),
            ).readActiveContent(f.paths)
          )?.snapshot ?? null,
        editing = require(
          resolve(bridgeDir, "backend/dist/content/editing.js"),
        ).createContentEditing({ pool: f.pool, clock, paths: f.paths, media, activeRead }),
        publication = require(
          resolve(bridgeDir, "backend/dist/content/publication/publisher.js"),
        ).createContentPublication({
          pool: f.pool,
          clock,
          paths: f.paths,
          media,
          assets: JSON.parse(
            await readFile(resolve(bridgeDir, "backend/content-assets.json"), "utf8"),
          ),
          assetRoot: resolve(bridgeDir, "frontend"),
          origin: f.baseUrl,
        });
      const before = await editing.get(f.actor, post.id),
        edited = await editing.saveDraft(
          f.actor,
          post.id,
          postInput(before, { title: "Nội dung mới còn nguyên" }),
          before.revision,
        ),
        job = await publication.request(f.actor, {
          action: "publish",
          targetId: edited.id,
          expectedRevision: edited.revision,
          idempotencyKey: randomUUID(),
        });
      await publication.reconcile();
      assert.equal((await publication.status(f.actor, job.id)).status, "succeeded");
      const current = await fetch(f.baseUrl + "/blog/compiled-new-content"),
        html = await current.text();
      assert.equal(current.status, 200);
      assert.match(html, /<h1[^>]*>Nội dung mới còn nguyên<\/h1>/);
      assert.doesNotMatch(html, /id="root"/);
      const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"?]+\.(?:js|css))"/g)].map(
        (match) => match[1],
      );
      assert.ok(assets.length >= 2);
      for (const path of assets) assert.equal((await fetch(f.baseUrl + path)).status, 200);
      await bridge.close();
      const forward = await previewRelease(cmsDir, {
        port,
        runtimeEnv: {
          ...f.env,
          BIBI_CONTENT_ASSET_ROOT: resolve(f.paths.root, "missing-source-assets"),
          BIBI_CONTENT_ASSETS_FILE: resolve(f.paths.root, "missing-source-descriptor.json"),
        },
      });
      t.after(() => forward.close());
      assert.equal((await fetch(f.baseUrl + "/api/ready")).status, 200);
      assert.match(
        await (await fetch(f.baseUrl + "/blog/compiled-new-content")).text(),
        /Nội dung mới còn nguyên/,
      );
      for (const path of ["/sitemap.xml", "/sitemaps/blog.xml", "/sitemaps/site.xml"])
        assert.match((await fetch(f.baseUrl + path)).headers.get("content-type"), /xml/);
      const caps = await (
        await fetch(f.baseUrl + "/api/content/capabilities", {
          headers: { Authorization: "Bearer " + (await f.login()) },
        })
      ).json();
      assert.equal(caps.canWrite, true);
      const ownedPorts = [port, Number(new URL(forward.relayUrl).port)];
      await forward.close();
      await assertPortsFree(ownedPorts);
    },
  );
}
if (isMain(import.meta.url)) {
  if (process.argv.length !== 4)
    throw Error("Supply separate bridge and local CMS acceptance bundle directories");
  await contentBundleAcceptance({
    bridgeDir: resolve(process.argv[2]),
    cmsDir: resolve(process.argv[3]),
  });
}
