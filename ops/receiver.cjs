"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");
const { spawnSync } = require("node:child_process");
const tar = require("tar");
const { validateManifest } = require("./release.cjs");
const deploy = require("./deploy.cjs");
function parseCommand(command) {
  const words = (command ?? "").trim().split(/\s+/);
  const [action, releaseId, checksum] = words;
  if (action === "check" && words.length === 1) return { action };
  if (!/^(?:[a-f0-9]{40}-[1-9][0-9]*|baseline)$/.test(releaseId ?? ""))
    throw new Error("Invalid release ID");
  if (
    ["deploy", "rollback"].includes(action) &&
    words.length === 2 &&
    (action === "rollback" || releaseId !== "baseline")
  )
    return { action, releaseId };
  if (
    action === "upload" &&
    releaseId !== "baseline" &&
    words.length === 3 &&
    /^[a-f0-9]{64}$/.test(checksum)
  )
    return { action, releaseId, checksum };
  throw new Error("SSH command not permitted");
}
async function inspectArchive(file, { maxExpandedBytes = 1024 ** 3 } = {}) {
  const violations = [];
  const seen = new Set();
  let size = 0,
    count = 0;
  await tar.t({
    file,
    strict: true,
    preservePaths: true,
    onReadEntry(entry) {
      const name = entry.path.replace(/\/$/, "");
      const parts = name.split("/");
      size += entry.size;
      count++;
      if (
        !["manifest.json", "frontend", "backend"].includes(parts[0]) ||
        parts.some((p) => !p || p === "." || p === "..") ||
        name.includes("\\") ||
        name.includes(":") ||
        path.posix.isAbsolute(name)
      )
        violations.push("Invalid archive path");
      if (!["File", "Directory"].includes(entry.type))
        violations.push("Invalid archive entry type/link");
      if (parts.some((p) => ["node_modules", ".git"].includes(p) || /^\.env(?:\.|$)/.test(p)))
        violations.push("Forbidden archive entry");
      if (seen.has(name)) violations.push("Duplicate archive entry");
      seen.add(name);
      if (size > maxExpandedBytes || count > 20000)
        violations.push("Archive exceeds expanded limit");
    },
  });
  if (violations.length) throw new Error(violations[0]);
  for (const name of [
    "manifest.json",
    "frontend/index.html",
    "frontend/version.json",
    "backend/dist/server.js",
    "backend/package.json",
    "backend/package-lock.json",
  ])
    if (!seen.has(name)) throw new Error("Missing archive entry: " + name);
  return { expandedBytes: size };
}
async function acceptArchive(config, id, checksum, file) {
  const bytes = await fs.readFile(file);
  if (createHash("sha256").update(bytes).digest("hex") !== checksum)
    throw new Error("Archive checksum mismatch");
  if (bytes.length > (config.maxArchiveBytes ?? 256 * 1024 ** 2))
    throw new Error("Archive too large");
  const { expandedBytes } = await inspectArchive(file, config);
  if (
    (await deploy.managedBytes(config.root)) + expandedBytes + bytes.length >
    (config.maxManagedBytes ?? 2 * 1024 ** 3)
  )
    throw new Error("Expanded release exceeds quota budget");
  const base = path.join(config.root, "releases");
  await fs.mkdir(base, { recursive: true });
  const dest = deploy.inside(base, path.join(base, id));
  try {
    const old = await fs.readFile(path.join(dest, ".archive-sha256"), "utf8");
    if (old === checksum) return;
    throw new Error("Immutable release already exists with different checksum");
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  const staging = deploy.inside(config.root, path.join(config.root, ".unpack-" + randomUUID()));
  await fs.mkdir(staging);
  try {
    await tar.x({ file, cwd: staging, strict: true, preservePaths: false });
    const manifest = validateManifest(
      JSON.parse(await fs.readFile(path.join(staging, "manifest.json"), "utf8")),
      { requireCI: true },
    );
    const fe = JSON.parse(await fs.readFile(path.join(staging, "frontend/version.json"), "utf8"));
    if (manifest.releaseId !== id || fe.releaseId !== id || fe.sourceSha !== manifest.sourceSha)
      throw new Error("Bundle release mismatch");
    await fs.writeFile(path.join(staging, ".archive-sha256"), checksum);
    await fs.rename(staging, dest);
  } catch (e) {
    await fs.rm(staging, { recursive: true, force: true });
    throw e;
  }
}
async function main() {
  const config = JSON.parse(await fs.readFile(process.argv[2], "utf8"));
  if (
    !["staging", "production"].includes(config.environment) ||
    !path.isAbsolute(config.root) ||
    !path.isAbsolute(config.site)
  )
    throw new Error("Invalid deploy configuration");
  const command = parseCommand(process.env.SSH_ORIGINAL_COMMAND);
  await fs.mkdir(config.root, { recursive: true });
  if (process.argv[3] !== "--locked") {
    const result = spawnSync(
      "flock",
      [
        "-x",
        "-w",
        "120",
        path.join(config.root, "deploy.lock"),
        process.execPath,
        __filename,
        process.argv[2],
        "--locked",
      ],
      { env: process.env, stdio: "inherit" },
    );
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
    return;
  }
  if (command.action === "check") {
    if (Number(process.versions.node.split(".")[0]) !== 24) throw new Error("Node 24 required");
    await fs.access(config.site);
    console.log(
      JSON.stringify({ ok: true, environment: config.environment, node: process.version }),
    );
    return;
  }
  if (command.action === "upload") {
    const archive = path.join(config.root, ".upload-" + randomUUID() + ".tgz");
    let size = 0;
    const used = await deploy.managedBytes(config.root);
    const max = config.maxManagedBytes ?? 2 * 1024 ** 3;
    const disk = await fs.statfs(config.root);
    if (disk.bavail * disk.bsize < 2 * (config.maxArchiveBytes ?? 256 * 1024 ** 2))
      throw new Error("Insufficient disk space");
    const handle = await fs.open(archive, "wx", 0o600);
    try {
      for await (const chunk of process.stdin) {
        size += chunk.length;
        if (size > (config.maxArchiveBytes ?? 256 * 1024 ** 2) || used + size * 3 > max)
          throw new Error("Upload exceeds quota budget");
        await handle.write(chunk);
      }
      await handle.close();
      await acceptArchive(config, command.releaseId, command.checksum, archive);
      console.log(JSON.stringify({ uploaded: command.releaseId }));
    } finally {
      await handle.close().catch(() => {});
      await fs.rm(archive, { force: true });
    }
  } else if (command.action === "deploy") {
    await deploy.activateRelease(config, command.releaseId);
    await deploy.pruneReleases(config, { activeId: command.releaseId });
  } else await deploy.rollbackRelease(config, command.releaseId);
}
module.exports = { parseCommand, inspectArchive, acceptArchive };
if (require.main === module)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
