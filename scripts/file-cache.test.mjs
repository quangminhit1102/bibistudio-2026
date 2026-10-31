import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, writeFile, readFile, rm, stat, utimes } from "node:fs/promises";
import { createServer } from "node:http";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join } from "node:path";
import deploy from "../ops/deploy.cjs";

test("same-size epoch-dated public files refresh through activation and rollback", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "bibi-file-cache-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const site = join(root, "site");
  await mkdir(site);
  await writeFile(join(site, ".htaccess"), "original");
  const sha = "a".repeat(40);
  const ids = [`${sha}-1`, `${sha}-2`];
  for (const [i, id] of ids.entries()) {
    const dir = join(root, "releases", id);
    await mkdir(join(dir, "frontend/assets"), { recursive: true });
    await mkdir(join(dir, "frontend/catalogue"));
    await writeFile(
      join(dir, "manifest.json"),
      JSON.stringify({
        schemaVersion: 1,
        releaseId: id,
        sourceSha: sha,
        ciRunId: String(i + 1),
      }),
    );
    for (const file of ["index.html", "catalogue/paper.jpeg"]) {
      const name = join(dir, "frontend", file);
      await writeFile(name, i === 0 ? "AAAA" : "BBBB");
      await utimes(name, new Date(0), new Date(0));
    }
    await writeFile(join(dir, "frontend/assets/hash.js"), "immutable");
  }
  // Models the observed LiteSpeed file cache: same public path, size and
  // second-resolution mtime reuse bytes even when the symlink target changes.
  const cache = new Map();
  const server = createServer(async (req, res) => {
    try {
      const file = join(root, "current/frontend", req.url);
      const info = await stat(file);
      const key = `${info.size}:${Math.floor(info.mtimeMs / 1000)}`;
      let entry = cache.get(req.url);
      if (entry?.key !== key) {
        entry = { key, body: await readFile(file) };
        cache.set(req.url, entry);
      }
      res.end(entry.body);
    } catch {
      res.writeHead(500).end();
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const config = { root, site, environment: "staging" };
  const hooks = {
    install: async () => {},
    restart: async () => {},
    verify: async (_config, manifest) => {
      for (const file of ["index.html", "catalogue/paper.jpeg"]) {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/${file}`);
        assert.equal(await response.text(), manifest.releaseId === ids[0] ? "AAAA" : "BBBB");
      }
    },
  };
  await deploy.activateRelease(config, ids[0], hooks);
  await deploy.activateRelease(config, ids[1], hooks);
  await deploy.rollbackRelease(config, ids[0], hooks);
  assert.equal(await readFile(join(site, "assets/hash.js"), "utf8"), "immutable");
});
