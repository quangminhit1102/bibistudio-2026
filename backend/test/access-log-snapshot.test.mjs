import test from "node:test";
import assert from "node:assert/strict";
import { readFile, unlink, writeFile, symlink, stat, readdir, appendFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { gzipSync } from "node:zlib";
import { archiveFixture, accessLogLine } from "./helpers/access-logs.mjs";
import { discoverAccessLogArchives } from "../dist/access-logs/sources.js";
import { snapshotArchive } from "../dist/access-logs/snapshot.js";
const signal = () => AbortSignal.timeout(10000);
test("discover only measured domain archives, with canonical transport and no current log files", async (t) => {
  const f = await archiveFixture(t);
  await f.write([accessLogLine()]);
  for (const name of ["other.com-Nov-2026.gz", f.config.domainAlias, "staging." + f.basename])
    await writeFile(join(f.config.archiveDirectory, name), gzipSync(Buffer.from("ignored")));
  await writeFile(
    join(f.config.archiveDirectory, f.config.domainAlias + "-ssl_log-Oct-2026.gz"),
    gzipSync(Buffer.from("ssl")),
  );
  const found = await discoverAccessLogArchives(f.config);
  assert.equal(found.length, 2);
  assert.deepEqual(found.map((x) => x.transport).sort(), ["http", "https"]);
});
test("private immutable snapshot survives original deletion and is reusable", async (t) => {
  const f = await archiveFixture(t);
  await f.write([accessLogLine()]);
  const [source] = await discoverAccessLogArchives(f.config);
  const snapshot = await snapshotArchive(source, f.config, signal());
  assert.equal(
    createHash("sha256")
      .update(await readFile(snapshot.path))
      .digest("hex"),
    snapshot.compressedSha256,
  );
  if (process.platform !== "win32") assert.equal((await stat(snapshot.path)).mode & 0o777, 0o600);
  const repeated = await snapshotArchive(source, f.config, signal());
  assert.equal(repeated.path, snapshot.path);
  await unlink(f.file);
  assert.ok((await readFile(snapshot.path)).length > 0);
});
test("compressed/work limits and source mismatch are rejected before copying", async (t) => {
  const f = await archiveFixture(t, { compressedBytes: 200 });
  await writeFile(f.file, gzipSync(randomBytes(2000)));
  const [source] = await discoverAccessLogArchives(f.config);
  await assert.rejects(snapshotArchive(source, f.config, signal()), /limit|quota/i);
  await assert.rejects(
    snapshotArchive({ ...source, path: join(f.root, "outside.gz") }, f.config, signal()),
    /source|path/i,
  );
  await assert.rejects(
    discoverAccessLogArchives({ ...f.config, domainAlias: "../../etc" }),
    /config|domain/i,
  );
});
test("archive symlink is never followed", { skip: process.platform === "win32" }, async (t) => {
  const f = await archiveFixture(t);
  const outside = join(f.root, "outside.gz");
  await writeFile(outside, gzipSync(Buffer.from("must-not-read")));
  await symlink(outside, f.file);
  await assert.rejects(discoverAccessLogArchives(f.config), /regular|symlink|source/i);
});
test("source open permission failure does not strand a pending directory", async (t) => {
  const f = await archiveFixture(t);
  await f.write([accessLogLine()]);
  const [source] = await discoverAccessLogArchives(f.config);
  const api = createRequire(import.meta.url)("node:fs/promises"),
    original = api.open;
  api.open = async (...args) => {
    if (args[0] === source.path) throw Object.assign(Error("fixture denied"), { code: "EACCES" });
    return original(...args);
  };
  try {
    await assert.rejects(snapshotArchive(source, f.config, signal()), /denied/);
  } finally {
    api.open = original;
  }
  assert.deepEqual(await readdir(f.config.workDirectory), []);
});
test("source append after opening is detected and partial copy removed", async (t) => {
  const f = await archiveFixture(t);
  await f.write([accessLogLine()]);
  const [source] = await discoverAccessLogArchives(f.config);
  const api = createRequire(import.meta.url)("node:fs/promises"),
    original = api.open;
  let armed = true;
  api.open = async (...args) => {
    const handle = await original(...args);
    if (args[0] !== source.path) return handle;
    return new Proxy(handle, {
      get(target, name) {
        if (name === "stat")
          return async (...params) => {
            const value = await target.stat(...params);
            if (armed) {
              armed = false;
              await appendFile(f.file, gzipSync(Buffer.from("appended\n")));
            }
            return value;
          };
        const value = target[name];
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  };
  try {
    await assert.rejects(snapshotArchive(source, f.config, signal()), /SOURCE_CHANGED/);
  } finally {
    api.open = original;
  }
  assert.deepEqual(await readdir(f.config.workDirectory), []);
});
test("work quota is independent of per-file compressed limit", async (t) => {
  const f = await archiveFixture(t, { workBytes: 4100 });
  await f.write([accessLogLine()]);
  const [source] = await discoverAccessLogArchives(f.config);
  await assert.rejects(snapshotArchive(source, f.config, signal()), /quota|limit/i);
});
