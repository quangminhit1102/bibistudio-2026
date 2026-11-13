import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, symlink, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import * as tar from "tar";
const run = promisify(execFile);
export async function legacyContextBackend(t) {
  const sourceSha = "ee12307cf68f45484d59c3b77c2f6f7f83a07f47";
  const dir = await mkdtemp(join(tmpdir(), "bibi-pinned-v5-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const { stdout } = await run(
    "git",
    [
      "archive",
      sourceSha,
      "backend/src",
      "backend/package.json",
      "backend/tsconfig.json",
      "backend/tsconfig.build.json",
    ],
    { encoding: "buffer", maxBuffer: 16 * 1024 ** 2, windowsHide: true },
  );
  const file = join(dir, "source.tar");
  await writeFile(file, stdout);
  await tar.x({ file, cwd: dir, strip: 1 });
  await symlink(
    resolve("backend/node_modules"),
    join(dir, "node_modules"),
    process.platform === "win32" ? "junction" : "dir",
  );
  await run(
    process.execPath,
    [resolve("backend/node_modules/typescript/bin/tsc"), "-p", join(dir, "tsconfig.build.json")],
    { windowsHide: true },
  );
  const require = createRequire(join(dir, "package.json"));
  return {
    sourceSha,
    createApp: require(join(dir, "dist/app.js")).createApp,
    collectVisitor: require(join(dir, "dist/visitors/collector.js")).collectVisitor,
  };
}
