import { cp, mkdir, readFile, readdir, writeFile, rm, stat } from "node:fs/promises";
import { join, resolve, relative } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import * as tar from "tar";
import { root, run, isMain } from "./runtime.mjs";
import { validateCatalogue } from "./catalogue-images.mjs";
import { makeManifest, validateManifest } from "./release-manifest.mjs";

export async function validateBundle(dir) {
  for (const name of [
    "manifest.json",
    "frontend/index.html",
    "frontend/version.json",
    "frontend/assets",
    "backend/dist/server.js",
    "backend/package.json",
    "backend/package-lock.json",
  ]) {
    try {
      await stat(join(dir, name));
    } catch {
      throw new Error(`Missing bundle output: ${name}`);
    }
  }
  const manifest = validateManifest(JSON.parse(await readFile(join(dir, "manifest.json"), "utf8")));
  const fe = JSON.parse(await readFile(join(dir, "frontend/version.json"), "utf8"));
  if (fe.releaseId !== manifest.releaseId || fe.sourceSha !== manifest.sourceSha)
    throw new Error("FE/BE release mismatch");
  async function scan(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      if (
        entry.isSymbolicLink() ||
        ["node_modules", ".git"].includes(entry.name) ||
        /^\.env(?:\.|$)/.test(entry.name)
      )
        throw new Error(`Forbidden bundle entry: ${entry.name}`);
      if (entry.isDirectory()) await scan(join(path, entry.name));
    }
  }
  await scan(dir);
  return manifest;
}
export async function buildRelease({
  sourceSha,
  ciRunId = null,
  outputDir = join(root, ".releases"),
} = {}) {
  sourceSha ??= execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const manifest = makeManifest(sourceSha, ciRunId);
  const base = resolve(outputDir);
  const bundleDir = join(base, manifest.releaseId);
  if (relative(base, bundleDir).startsWith("..") || bundleDir === base)
    throw new Error("Invalid build target");
  await validateCatalogue(root);
  await mkdir(base, { recursive: true });
  if (ciRunId) {
    try {
      await stat(bundleDir);
      throw new Error("CI bundle already exists");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  } else await rm(bundleDir, { recursive: true, force: true });
  const env = {
    ...process.env,
    VITE_BIBI_RELEASE_ID: manifest.releaseId,
    VITE_BIBI_SOURCE_SHA: manifest.sourceSha,
  };
  await run(
    process.execPath,
    ["node_modules/vite/bin/vite.js", "build", "--config", "vite.config.ts"],
    { env },
  );
  await run(
    process.execPath,
    ["node_modules/vite/bin/vite.js", "build", "--config", "vite.cpanel.config.ts"],
    { env },
  );
  await run(process.execPath, [
    "backend/node_modules/typescript/bin/tsc",
    "-p",
    "backend/tsconfig.build.json",
  ]);
  await mkdir(join(bundleDir, "backend"), { recursive: true });
  await cp(join(root, "dist-cpanel"), join(bundleDir, "frontend"), { recursive: true });
  await cp(join(root, "backend/dist"), join(bundleDir, "backend/dist"), { recursive: true });
  for (const file of ["package.json", "package-lock.json"])
    await cp(join(root, "backend", file), join(bundleDir, "backend", file));
  for (const file of ["manifest.json", "frontend/version.json"])
    await writeFile(join(bundleDir, file), JSON.stringify(manifest, null, 2) + "\n");
  await validateBundle(bundleDir);
  const archive = join(base, `${manifest.releaseId}.tgz`);
  await tar.c({ cwd: bundleDir, file: archive, gzip: true, portable: true, mtime: new Date(0) }, [
    "manifest.json",
    "frontend",
    "backend",
  ]);
  const checksumFile = archive + ".sha256";
  await writeFile(
    checksumFile,
    createHash("sha256")
      .update(await readFile(archive))
      .digest("hex") + "\n",
  );
  console.log(`BIBI_RELEASE ${JSON.stringify({ archive, checksumFile, manifest })}`);
  return { archive, checksumFile, manifest, bundleDir };
}
if (isMain(import.meta.url)) {
  try {
    const bundle = await buildRelease({
      sourceSha: process.env.GITHUB_SHA,
      ciRunId: process.env.GITHUB_RUN_ID ?? null,
    });
    if (process.argv.includes("--preview")) {
      const { previewRelease } = await import("./preview.mjs");
      const app = await previewRelease(bundle.bundleDir);
      for (const signal of ["SIGINT", "SIGTERM"])
        process.once(signal, async () => {
          await app.close();
          process.exit(0);
        });
    }
  } catch (error) {
    console.error(error.stack);
    process.exitCode = 1;
  }
}
