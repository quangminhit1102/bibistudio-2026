import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, writeFile, access, symlink, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import * as tar from "tar";
const run = promisify(execFile);
const sha = "3beb58fc9f2f2fc7125e91bdb6df85c179dbbccf";
/** Pinned old executable, never a mock of the current application. */
export async function legacyVisitorBackend(t, { fresh = false } = {}) {
  let directory = resolve(".superpowers/sdd/2026-11-13-visitor-analytics/old-backend");
  let captured = false;
  try {
    captured = (await readFile(join(directory, "source-sha"), "utf8")).trim() === sha;
    await access(join(directory, "package.json"));
    await access(join(directory, "dist/app.js"));
  } catch {
    captured = false;
  }
  if (!captured || fresh) {
    directory = await mkdtemp(join(tmpdir(), "bibi-legacy-visitor-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const archive = join(directory, "source.tar");
    const { stdout } = await run(
      "git",
      [
        "archive",
        sha,
        "backend/src",
        "backend/package.json",
        "backend/tsconfig.json",
        "backend/tsconfig.build.json",
      ],
      { encoding: "buffer", maxBuffer: 16 * 1024 ** 2, windowsHide: true },
    );
    await writeFile(archive, stdout);
    await tar.x({ file: archive, cwd: directory, strip: 1 });
    await symlink(
      resolve("backend/node_modules"),
      join(directory, "node_modules"),
      process.platform === "win32" ? "junction" : "dir",
    );
    await run(
      process.execPath,
      [
        resolve("backend/node_modules/typescript/bin/tsc"),
        "-p",
        join(directory, "tsconfig.build.json"),
      ],
      { windowsHide: true },
    );
    await writeFile(join(directory, "source-sha"), sha + "\n");
  }
  const require = createRequire(join(directory, "package.json"));
  return {
    createApp: require(join(directory, "dist/app.js")).createApp,
    directory,
    sourceSha: sha,
  };
}
