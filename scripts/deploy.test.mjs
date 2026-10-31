import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, writeFile, readFile, rm, readlink, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import deploy from "../ops/deploy.cjs";
const sha = "a".repeat(40),
  first = sha + "-1",
  second = sha + "-2";
test("production refuses first activation without a verified rollback target", async (t) => {
  const config = await fixture(t);
  config.environment = "production";
  await assert.rejects(
    deploy.activateRelease(config, first, {
      install: async () => {},
      restart: async () => {},
      verify: async () => {},
    }),
    /baseline|previous/i,
  );
  assert.equal(await readFile(join(config.site, ".htaccess"), "utf8"), "old-routing");
});
test(
  "public routing has Apache-readable permissions",
  { skip: process.platform === "win32" ? "POSIX permission bits verified on Linux CI" : false },
  async (t) => {
    const config = await fixture(t);
    await deploy.activateRelease(config, first, {
      install: async () => {},
      restart: async () => {},
      verify: async () => {},
    });
    assert.equal((await stat(join(config.site, ".htaccess"))).mode & 0o777, 0o644);
  },
);
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "bibi-deploy-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const site = join(root, "site");
  await mkdir(site);
  await writeFile(join(site, ".htaccess"), "old-routing");
  const config = {
    root,
    site,
    environment: "staging",
    baseUrl: "http://127.0.0.1",
    maxManagedBytes: 2e9,
  };
  for (const [id, run] of [
    [first, "1"],
    [second, "2"],
  ]) {
    const dir = join(root, "releases", id);
    await mkdir(join(dir, "frontend/assets"), { recursive: true });
    await mkdir(join(dir, "backend"));
    await writeFile(
      join(dir, "manifest.json"),
      JSON.stringify({ schemaVersion: 1, releaseId: id, sourceSha: sha, ciRunId: run }),
    );
    await writeFile(join(dir, "frontend/index.html"), "test");
    await writeFile(join(dir, "frontend/assets/a.js"), "immutable");
  }
  return config;
}
test("activation selects release, rejects stale staging and rollback restores pointer", async (t) => {
  const config = await fixture(t);
  const hooks = { install: async () => {}, restart: async () => {}, verify: async () => {} };
  await deploy.activateRelease(config, first, hooks);
  await deploy.activateRelease(config, second, hooks);
  assert.ok((await readlink(join(config.root, "current"))).endsWith(second));
  await assert.rejects(deploy.activateRelease(config, first, hooks), /older/i);
  await deploy.rollbackRelease(config, first, hooks);
  assert.ok((await readlink(join(config.root, "current"))).endsWith(first));
});
test("failed health check restores previous release and reports failure", async (t) => {
  const config = await fixture(t);
  const hooks = { install: async () => {}, restart: async () => {}, verify: async () => {} };
  await deploy.activateRelease(config, first, hooks);
  const verify = async (_c, m) => {
    if (m.releaseId === second) throw new Error("health failure");
  };
  await assert.rejects(
    deploy.activateRelease(config, second, { ...hooks, verify }),
    /health failure/,
  );
  assert.ok((await readlink(join(config.root, "current"))).endsWith(first));
});
test("asset collision is rejected without replacing an existing hashed file", async (t) => {
  const config = await fixture(t);
  await mkdir(join(config.site, "assets"));
  await writeFile(join(config.site, "assets/a.js"), "old-content");
  await assert.rejects(
    deploy.activateRelease(config, first, {
      install: async () => {},
      restart: async () => {},
      verify: async () => {},
    }),
    /collision/i,
  );
  assert.equal(await readFile(join(config.site, "assets/a.js"), "utf8"), "old-content");
});

test("first deployment failure restores original routing and removes current", async (t) => {
  const config = await fixture(t);
  await assert.rejects(
    deploy.activateRelease(config, first, {
      install: async () => {},
      restart: async () => {},
      verify: async () => {
        throw new Error("unhealthy");
      },
    }),
    /unhealthy/,
  );
  assert.equal(await readFile(join(config.site, ".htaccess"), "utf8"), "old-routing");
  await assert.rejects(readlink(join(config.root, "current")), { code: "ENOENT" });
});

test("baseline rollback restores original static routing", async (t) => {
  const config = await fixture(t);
  const baseline = join(config.root, "releases/baseline");
  await mkdir(join(baseline, "frontend"), { recursive: true });
  await writeFile(join(baseline, "frontend/index.html"), "baseline");
  await writeFile(
    join(baseline, "manifest.json"),
    JSON.stringify({ isBaseline: true, releaseId: "baseline" }),
  );
  await writeFile(join(config.root, "baseline.htaccess"), "baseline-routing");
  await deploy.rollbackRelease(config, "baseline", {
    restart: async () => {},
    verify: async () => {},
  });
  assert.equal(await readFile(join(config.site, ".htaccess"), "utf8"), "baseline-routing");
});

test("rollback verification failure is reported distinctly", async (t) => {
  const config = await fixture(t);
  const hooks = { install: async () => {}, restart: async () => {}, verify: async () => {} };
  await deploy.activateRelease(config, first, hooks);
  await assert.rejects(
    deploy.activateRelease(config, second, {
      ...hooks,
      verify: async () => {
        throw new Error("broken");
      },
    }),
    /ROLLBACK FAILED/,
  );
});

test("retention keeps active, previous, baseline and five recent successful releases", async (t) => {
  const config = await fixture(t);
  for (let i = 3; i <= 10; i++) {
    const dir = join(config.root, "releases", sha + "-" + i);
    await mkdir(join(dir, "frontend/assets"), { recursive: true });
    await writeFile(join(dir, ".successful"), new Date(2026, 0, i).toISOString());
  }
  await writeFile(join(config.root, "releases", first, ".successful"), "2025-01-01");
  await writeFile(join(config.root, "previous"), first);
  await deploy.pruneReleases(config, { activeId: second });
  const names = await readdir(join(config.root, "releases"));
  assert.ok(names.includes(first) && names.includes(second));
  for (let i = 6; i <= 10; i++) assert.ok(names.includes(sha + "-" + i));
  assert.ok(!names.includes(sha + "-3"));
});
