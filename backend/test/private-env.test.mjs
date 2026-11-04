import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm, symlink, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
const { readPrivateEnvironment } = createRequire(import.meta.url)("../dist/db/private-env.js");
test("private environment reads only owned absolute regular files, never ambient secrets", async () => {
  const dir = await mkdtemp(join(tmpdir(), "bibi-private-env-"));
  const file = join(dir, "runtime.env");
  try {
    await writeFile(file, 'DB_NAME=bibi_test\nDB_PASSWORD="only-test"\n', { mode: 0o600 });
    assert.equal(readPrivateEnvironment(file).DB_NAME, "bibi_test");
    assert.equal(readPrivateEnvironment(file).PATH, undefined);
    assert.throws(() => readPrivateEnvironment(undefined));
    assert.throws(() => readPrivateEnvironment("runtime.env"));
    assert.throws(() => readPrivateEnvironment(dir));
    if (process.platform !== "win32") {
      await chmod(file, 0o644);
      assert.throws(() => readPrivateEnvironment(file), /0600/);
      await chmod(file, 0o600);
      const link = join(dir, "linked.env");
      await symlink(file, link);
      assert.throws(() => readPrivateEnvironment(link), /regular/);
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});
