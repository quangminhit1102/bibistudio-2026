import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { isMain, root, run } from "./runtime.mjs";
import { validateBundle, buildContentAcceptanceBundle } from "./build.mjs";
import { previewRelease } from "./preview.mjs";
import { createContentE2eFixture } from "../tests/e2e/helpers/content-fixture.mjs";
import { postInput } from "../backend/test/helpers/content-publication.mjs";
import { assertPortsFree } from "./process-group.mjs";
import { verifyCmsBrowser, verifyBridgeBrowser } from "../tests/e2e/helpers/content-scenarios.mjs";
async function ownedFixture(work) {
  const cleanup = [];
  let failed = false;
  try {
    return await work({ after: (fn) => cleanup.push(fn) });
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    let cleanupFailed = false;
    for (const close of cleanup)
      try {
        await close();
      } catch {
        cleanupFailed = true;
      }
    if (cleanupFailed && !failed) throw Error("Owned content artifact cleanup failed");
  }
}

export async function contentBundleAcceptance({ bridgeDir, cmsDir }) {
  return ownedFixture(async (t) => {
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
      editing = require(resolve(bridgeDir, "backend/dist/content/editing.js")).createContentEditing(
        { pool: f.pool, clock, paths: f.paths, media, activeRead },
      ),
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
    console.log("Compiled CMS → bridge → CMS preserved newer content");
  });
}
export async function verifyContentBundle({ bundleDir, evidenceDir, mode }) {
  const manifest = await validateBundle(bundleDir),
    actual = manifest.content ? "cms" : manifest.contentPublic ? "bridge" : null;
  if (actual !== mode) throw Error("Content acceptance must use the artifact's actual capability");
  await mkdir(evidenceDir, { recursive: true });
  return ownedFixture(async (t) => {
    const f = await createContentE2eFixture(t, { bundleDir, mode });
    let checks, screenshots;
    if (mode === "cms") {
      const result = await verifyCmsBrowser(t, f, { mode: "compiled-cms", evidenceDir });
      checks = result.checks;
      screenshots = ["article-no-js-mobile.png", "editor-published.png"];
    } else {
      const post = await f.createPost({
        slug: "bridge-current-content",
        title: "Nội dung trước thay đổi",
      });
      await f.publish(post);
      const before = await f.editing.get(f.actor, post.id),
        edited = await f.editing.saveDraft(
          f.actor,
          post.id,
          postInput(before, { title: "Nội dung mới sau bridge" }),
          before.revision,
        );
      await f.publish(edited);
      const response = await fetch(f.baseUrl + "/blog/bridge-current-content"),
        html = await response.text();
      assert.equal(response.status, 200);
      assert.match(html, /<h1[^>]*>Nội dung mới sau bridge<\/h1>/);
      assert.doesNotMatch(html, /id="root"/);
      const token = await f.login(),
        rejected = await fetch(f.baseUrl + "/api/content/posts", {
          method: "POST",
          headers: { Authorization: "Bearer " + token },
        });
      assert.equal(rejected.status, 503);
      await rejected.arrayBuffer();
      await verifyBridgeBrowser(t, f, { postId: post.id, evidenceDir });
      checks = { readOnly: true, mutation503: true, currentPublishedData: true, initialHtml: true };
      screenshots = ["bridge-read-only.png"];
    }
    const active = await readFile(f.paths.active, "utf8");
    const report = {
      ok: true,
      sourceSha: manifest.sourceSha,
      releaseId: manifest.releaseId,
      generationId: JSON.parse(active).generationId,
      mode,
      checks,
      screenshots,
    };
    await writeFile(join(evidenceDir, "report.json"), JSON.stringify(report, null, 2));
    console.log("Content artifact accepted: " + manifest.releaseId + " (" + mode + ")");
    return report;
  });
}
async function main() {
  const args = process.argv.slice(2);
  if (args.length === 2)
    return contentBundleAcceptance({ bridgeDir: resolve(args[0]), cmsDir: resolve(args[1]) });
  if (args.length > 1) throw Error("Supply the exact built release directory");
  const sha =
    process.env.GITHUB_SHA ??
    execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const id = process.env.GITHUB_RUN_ID ? sha + "-" + process.env.GITHUB_RUN_ID : "local-" + sha;
  const bundleDir = resolve(args[0] ?? join(root, ".releases", id)),
    manifest = await validateBundle(bundleDir);
  if (manifest.sourceSha !== sha || (process.env.GITHUB_RUN_ID && manifest.releaseId !== id))
    throw Error("Compiled acceptance source/release identity mismatch");
  const actual = manifest.content ? "cms" : "bridge",
    alternate = actual === "cms" ? "bridge" : "cms";
  const variant = await buildContentAcceptanceBundle({
    sourceSha: sha,
    mode: alternate,
    outputDir: join(root, ".superpowers/content-ci-" + alternate),
  });
  for (const [directory, mode, label] of [
    [bundleDir, actual, "actual"],
    [variant.bundleDir, alternate, "local-" + alternate],
  ])
    await run(process.execPath, ["--test", "tests/e2e/content-bundle.spec.mjs"], {
      env: {
        ...process.env,
        BIBI_CONTENT_BUNDLE: directory,
        BIBI_CONTENT_MODE: mode,
        BIBI_CONTENT_EVIDENCE: join(root, ".superpowers/e2e/content-compiled", label),
      },
    });
  await contentBundleAcceptance({
    bridgeDir: actual === "bridge" ? bundleDir : variant.bundleDir,
    cmsDir: actual === "cms" ? bundleDir : variant.bundleDir,
  });
}
if (isMain(import.meta.url)) {
  await main();
}
