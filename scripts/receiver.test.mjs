import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, writeFile, rm, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import * as tar from "tar";
import receiver from "../ops/receiver.cjs";
const id = "a".repeat(40) + "-12";
test("SSH receiver accepts only scoped protocol, not shell syntax or arbitrary paths", () => {
  assert.deepEqual(receiver.parseCommand(`deploy ${id}`), { action: "deploy", releaseId: id });
  for (const cmd of [
    `deploy ../production`,
    `deploy ${id};id`,
    `upload ${id} bad`,
    `check extra`,
    `sh`,
    `rollback ../../vhplastic.com`,
  ])
    assert.throws(() => receiver.parseCommand(cmd));
});
test("archive validation rejects traversal and links before extraction", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "bibi-tar-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const header = new tar.Header({ path: "../outside", type: "File", size: 0 });
  header.encode();
  const archive = join(dir, "bad.tar");
  await writeFile(archive, Buffer.concat([header.block, Buffer.alloc(1024)]));
  await assert.rejects(receiver.inspectArchive(archive), /path|entry/i);
  const linked = new tar.Header({
    path: "frontend/link",
    type: "SymbolicLink",
    linkpath: "/etc/passwd",
    size: 0,
  });
  linked.encode();
  await writeFile(archive, Buffer.concat([linked.block, Buffer.alloc(1024)]));
  await assert.rejects(receiver.inspectArchive(archive), /type|link/i);
});
test("checksum failure leaves releases unchanged", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "bibi-upload-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = join(root, "archive.tgz");
  await writeFile(file, "not tar");
  await assert.rejects(
    receiver.acceptArchive({ root, maxExpandedBytes: 1e6 }, id, "0".repeat(64), file),
    /checksum/i,
  );
  const text = await readFile(file, "utf8");
  assert.equal(text, "not tar");
});

test("archive identity is immutable and expanded quota is enforced", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "bibi-accept-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const bundle = join(root, "bundle");
  await mkdir(join(bundle, "frontend"), { recursive: true });
  await mkdir(join(bundle, "backend/dist"), { recursive: true });
  const manifest = { schemaVersion: 1, releaseId: id, sourceSha: "a".repeat(40), ciRunId: "12" };
  for (const [file, text] of Object.entries({
    "manifest.json": JSON.stringify(manifest),
    "frontend/version.json": JSON.stringify(manifest),
    "frontend/index.html": "html",
    "backend/dist/server.js": "server",
    "backend/package.json": "{}",
    "backend/package-lock.json": "{}",
  }))
    await writeFile(join(bundle, file), text);
  const archive = join(root, "valid.tgz");
  await tar.c({ cwd: bundle, file: archive, gzip: true }, ["manifest.json", "frontend", "backend"]);
  const digest = createHash("sha256")
    .update(await readFile(archive))
    .digest("hex");
  await assert.rejects(
    receiver.acceptArchive({ root, maxManagedBytes: 1 }, id, digest, archive),
    /quota/i,
  );
  await receiver.acceptArchive({ root }, id, digest, archive);
  await receiver.acceptArchive({ root }, id, digest, archive);
  await writeFile(join(bundle, "frontend/index.html"), "changed");
  await tar.c({ cwd: bundle, file: archive, gzip: true }, ["manifest.json", "frontend", "backend"]);
  const other = createHash("sha256")
    .update(await readFile(archive))
    .digest("hex");
  await assert.rejects(receiver.acceptArchive({ root }, id, other, archive), /immutable/i);
  assert.equal(await readFile(join(root, "releases", id, "frontend/index.html"), "utf8"), "html");
});
