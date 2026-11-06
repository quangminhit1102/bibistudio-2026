import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createAvatarStore } from "../dist/profile/avatar-store.js";
const image = { bytes: Buffer.from("normalized pixels"), width: 2, height: 2, format: "png" };
async function fixture(t) {
  const root = await fs.mkdtemp(join(tmpdir(), "bibi-avatar-store-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return { root, store: createAvatarStore({ root }) };
}
test("private store creates immutable verified files, protects collisions and never exposes client paths", async (t) => {
  const { root, store } = await fixture(t),
    saved = await store.write(image);
  assert.equal(saved.byteLength, image.bytes.length);
  assert.deepEqual(await store.read(saved), image.bytes);
  const hook = t.mock.method(crypto, "randomUUID", () => saved.id);
  await assert.rejects(store.write({ ...image, bytes: Buffer.from("replacement") }));
  hook.mock.restore();
  assert.deepEqual(await store.read(saved), image.bytes);
  await assert.rejects(store.read({ ...saved, id: "../../secret" }));
  await fs.writeFile(join(root, saved.id + ".png"), "corruption");
  await assert.rejects(store.read(saved));
  await store.remove(saved.id, saved.format);
  await assert.rejects(store.read(saved));
});
test(
  "root and files reject symlinks at creation and use",
  { skip: process.platform === "win32" ? "Symlink behavior exercised on Linux CI" : false },
  async (t) => {
    const { root, store } = await fixture(t),
      other = await fixture(t),
      saved = await store.write(image);
    const alias = join(other.root, "alias");
    await fs.symlink(root, alias, "dir");
    assert.throws(() => createAvatarStore({ root: alias }));
    await fs.unlink(join(root, saved.id + ".png"));
    await fs.symlink(join(other.root, "outside"), join(root, saved.id + ".png"));
    await assert.rejects(store.read(saved));
    await fs.rename(root, root + "-moved");
    t.after(() => fs.rm(root + "-moved", { recursive: true, force: true }));
    await fs.symlink(other.root, root, "dir");
    await assert.rejects(store.write(image));
  },
);
test("file and directory modes are private and failed fsync retains the old file", async (t) => {
  const { root, store } = await fixture(t),
    saved = await store.write(image);
  if (process.platform !== "win32") {
    assert.equal((await fs.stat(root)).mode & 0o777, 0o700);
    assert.equal((await fs.stat(join(root, saved.id + ".png"))).mode & 0o777, 0o600);
  }
  const probe = await fs.open(join(root, "probe"), "w"),
    prototype = Object.getPrototypeOf(probe);
  await probe.close();
  const mock = t.mock.method(prototype, "sync", async () => {
    throw new Error("controlled fsync failure");
  });
  await assert.rejects(store.write(image));
  mock.mock.restore();
  assert.deepEqual(await store.read(saved), image.bytes);
  assert.ok(!(await fs.readdir(root)).some((name) => name.startsWith(".pending-")));
  const renameFailure = t.mock.method(fs, "rename", async () => {
    throw new Error("controlled rename failure");
  });
  await assert.rejects(store.write(image));
  renameFailure.mock.restore();
  assert.deepEqual(await store.read(saved), image.bytes);
  assert.deepEqual((await fs.readdir(root)).sort(), ["probe", saved.id + ".png"].sort());
  assert.throws(() => createAvatarStore({ root: "relative/path" }));
  assert.throws(() => createAvatarStore({ root: resolve("public") }));
});
