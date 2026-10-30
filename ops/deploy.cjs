"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { randomUUID } = require("node:crypto");
const { validateManifest } = require("./release.cjs");
const execute = promisify(execFile);
function inside(base, target) {
  const relative = path.relative(path.resolve(base), path.resolve(target));
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative))
    throw new Error("Path outside configured environment");
  return path.resolve(target);
}
async function inspectRelease(config, id) {
  if (!/^(?:[a-f0-9]{40}-[1-9][0-9]*|baseline)$/.test(id)) throw new Error("Invalid release ID");
  const dir = inside(config.root, path.join(config.root, "releases", id));
  const real = await fs.realpath(dir);
  inside(path.join(config.root, "releases"), real);
  const m = JSON.parse(await fs.readFile(path.join(real, "manifest.json"), "utf8"));
  if (id === "baseline") {
    if (!m.isBaseline || m.releaseId !== id) throw new Error("Invalid baseline");
  } else {
    validateManifest(m, { requireCI: true });
    if (m.releaseId !== id) throw new Error("Release ID mismatch");
  }
  return { dir: real, manifest: m };
}
async function point(config, dir) {
  inside(path.join(config.root, "releases"), dir);
  const next = path.join(config.root, ".current-" + randomUUID());
  await fs.symlink(dir, next, process.platform === "win32" ? "junction" : "dir");
  const current = path.join(config.root, "current");
  if (process.platform === "win32")
    await fs.unlink(current).catch((e) => {
      if (e.code !== "ENOENT") throw e;
    });
  await fs.rename(next, current);
}
async function atomicWrite(file, bytes) {
  const next = file + ".new-" + randomUUID();
  await fs.writeFile(next, bytes, { mode: 0o600 });
  await fs.rename(next, file);
}
async function mergeAssets(config, dir) {
  const src = path.join(dir, "frontend/assets"),
    dest = path.join(config.site, "assets");
  await fs.mkdir(dest, { recursive: true });
  async function copy(from, to) {
    for (const entry of await fs.readdir(from, { withFileTypes: true })) {
      const a = path.join(from, entry.name),
        b = inside(config.site, path.join(to, entry.name));
      if (entry.isDirectory()) {
        await fs.mkdir(b, { recursive: true });
        await copy(a, b);
      } else if (entry.isFile()) {
        const bytes = await fs.readFile(a);
        let old;
        try {
          old = await fs.readFile(b);
        } catch (e) {
          if (e.code !== "ENOENT") throw e;
        }
        if (old && !old.equals(bytes)) throw new Error(`Immutable asset collision: ${entry.name}`);
        if (!old) await fs.writeFile(b, bytes, { flag: "wx" });
      } else throw new Error("Invalid asset entry");
    }
  }
  await copy(src, dest);
}
async function install(config, dir) {
  const env = {
    ...process.env,
    PATH: config.runtimeBin + path.delimiter + process.env.PATH,
    NODE_ENV: "production",
  };
  await execute(
    config.npmBin,
    ["ci", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"],
    { cwd: path.join(dir, "backend"), env, maxBuffer: 1024 * 1024, timeout: 180000 },
  );
}
async function restart(config) {
  await fs.mkdir(path.join(config.root, "app/tmp"), { recursive: true });
  await fs.writeFile(path.join(config.root, "app/tmp/restart.txt"), String(Date.now()));
}
async function verify(config, m) {
  const deadline = Date.now() + 60000;
  let last;
  do {
    try {
      if (!m.isBaseline) {
        const api = await fetch(config.baseUrl + "/api/version", {
          signal: AbortSignal.timeout(5000),
          cache: "no-store",
        });
        const v = await api.json();
        if (!api.ok || v.releaseId !== m.releaseId || v.sourceSha !== m.sourceSha)
          throw new Error("Backend release mismatch");
        const fe = await fetch(config.baseUrl + "/version.json", {
          signal: AbortSignal.timeout(5000),
          cache: "no-store",
        });
        const f = await fe.json();
        if (!fe.ok || f.releaseId !== m.releaseId || f.sourceSha !== m.sourceSha)
          throw new Error("Frontend release mismatch");
      }
      const page = await fetch(config.baseUrl + "/products/ca-phe-voi-nguoi-thuong-notebook", {
        signal: AbortSignal.timeout(5000),
      });
      if (!page.ok || !page.headers.get("content-type")?.includes("text/html"))
        throw new Error("Frontend HTTP check failed");
      const image = await fetch(config.baseUrl + "/catalogue/motivation-ca-phe-nguoi-thuong.jpeg", {
        signal: AbortSignal.timeout(5000),
      });
      if (!image.ok || !image.headers.get("content-type")?.startsWith("image/"))
        throw new Error("Catalogue image check failed");
      return;
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 1000));
    }
  } while (Date.now() < deadline);
  throw last ?? new Error("Health check timed out");
}
async function applyRouting(config, m) {
  if (m.isBaseline) {
    await atomicWrite(
      path.join(config.site, ".htaccess"),
      await fs.readFile(path.join(config.root, "baseline.htaccess")),
    );
    return;
  }
  const publicLink = path.join(config.site, "_bibi"),
    target = path.join(config.root, "current/frontend");
  try {
    const existing = await fs.readlink(publicLink);
    if (path.resolve(existing) !== path.resolve(target))
      throw new Error("Unexpected public release link");
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    await fs.symlink(target, publicLink, process.platform === "win32" ? "junction" : "dir");
  }
  let rules = await fs.readFile(path.join(__dirname, "frontend.htaccess.template"), "utf8");
  if (config.environment === "staging")
    rules +=
      '\n<IfModule mod_headers.c>\nHeader set X-Robots-Tag "noindex, nofollow"\n</IfModule>\n';
  await atomicWrite(path.join(config.site, ".htaccess"), rules);
}
async function currentTarget(config) {
  try {
    return await fs.realpath(path.join(config.root, "current"));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    return null;
  }
}
async function activateRelease(config, id, hooks = {}) {
  const { dir, manifest } = await inspectRelease(config, id);
  if (manifest.isBaseline) throw new Error("Use rollback for baseline");
  const old = await currentTarget(config);
  const originalRules = await fs.readFile(path.join(config.site, ".htaccess")).catch((e) => {
    if (e.code !== "ENOENT") throw e;
    return null;
  });
  let oldManifest;
  if (old) oldManifest = JSON.parse(await fs.readFile(path.join(old, "manifest.json"), "utf8"));
  let highest = "0";
  try {
    highest = (await fs.readFile(path.join(config.root, "highest-staging-run"), "utf8")).trim();
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  if (config.environment === "staging" && BigInt(manifest.ciRunId) < BigInt(highest))
    throw new Error("Refusing older staging release");
  await (hooks.install ?? install)(config, dir);
  await mergeAssets(config, dir);
  try {
    await point(config, dir);
    await applyRouting(config, manifest);
    await (hooks.restart ?? restart)(config);
    await (hooks.verify ?? verify)(config, manifest);
    await atomicWrite(path.join(dir, ".successful"), new Date().toISOString());
    if (old) await atomicWrite(path.join(config.root, "previous"), oldManifest.releaseId);
    if (config.environment === "staging")
      await atomicWrite(path.join(config.root, "highest-staging-run"), manifest.ciRunId);
    console.log(
      JSON.stringify({
        event: "deployed",
        environment: config.environment,
        releaseId: id,
        previousReleaseId: oldManifest?.releaseId ?? null,
      }),
    );
  } catch (error) {
    if (old) {
      try {
        await point(config, old);
        await applyRouting(config, oldManifest);
        await (hooks.restart ?? restart)(config);
        await (hooks.verify ?? verify)(config, oldManifest);
      } catch (rollback) {
        throw new Error(`Deploy failed: ${error.message}; ROLLBACK FAILED: ${rollback.message}`);
      }
    } else {
      await fs.unlink(path.join(config.root, "current")).catch((e) => {
        if (e.code !== "ENOENT") throw e;
      });
      if (originalRules) await atomicWrite(path.join(config.site, ".htaccess"), originalRules);
      else await fs.rm(path.join(config.site, ".htaccess"), { force: true });
      await (hooks.restart ?? restart)(config);
    }
    throw new Error(
      `Deploy failed: ${error.message}; ${old ? "previous release restored" : "no previous release exists"}`,
    );
  }
}
async function rollbackRelease(config, id, hooks = {}) {
  const { dir, manifest } = await inspectRelease(config, id);
  if (!manifest.isBaseline) await fs.access(path.join(dir, ".successful"));
  await point(config, dir);
  await applyRouting(config, manifest);
  await (hooks.restart ?? restart)(config);
  await (hooks.verify ?? verify)(config, manifest);
  console.log(
    JSON.stringify({ event: "rolled-back", environment: config.environment, releaseId: id }),
  );
}
async function managedBytes(dir) {
  let total = 0;
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    if (e.isSymbolicLink()) continue;
    const p = path.join(dir, e.name);
    total += e.isDirectory() ? await managedBytes(p) : (await fs.stat(p)).size;
  }
  return total;
}
async function pruneReleases(config, { activeId }) {
  const base = path.join(config.root, "releases");
  const keep = new Set([activeId, "baseline"]);
  try {
    keep.add((await fs.readFile(path.join(config.root, "previous"), "utf8")).trim());
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  const candidates = [];
  for (const entry of await fs.readdir(base, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^[a-f0-9]{40}-[1-9][0-9]*$/.test(entry.name)) continue;
    const dir = inside(base, path.join(base, entry.name));
    const real = await fs.realpath(dir);
    inside(base, real);
    if (real !== dir) throw new Error("Unexpected release link during retention");
    try {
      candidates.push({
        id: entry.name,
        dir,
        time: Date.parse(await fs.readFile(path.join(dir, ".successful"), "utf8")),
      });
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
  }
  candidates.sort((a, b) => b.time - a.time);
  for (const candidate of candidates.slice(0, 5)) keep.add(candidate.id);
  for (const candidate of candidates)
    if (!keep.has(candidate.id)) await fs.rm(candidate.dir, { recursive: true });
  // Hashed assets remain available for old tabs. A hard quota refuses new uploads
  // rather than removing unknown files or breaking the 30-day minimum.
}
module.exports = {
  inside,
  inspectRelease,
  activateRelease,
  rollbackRelease,
  managedBytes,
  pruneReleases,
};
