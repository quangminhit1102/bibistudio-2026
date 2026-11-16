"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  { parseEnv } = require("node:util");
const { readFile, lstat, realpath } = require("node:fs/promises");
function assertReceiverContentLock(root) {
  if (process.platform !== "linux") throw Error("Linux receiver lock required");
  const file = path.join(root, "deploy.lock"),
    fd = fs.fstatSync(3),
    named = fs.lstatSync(file);
  if (
    !fd.isFile() ||
    named.isSymbolicLink() ||
    !named.isFile() ||
    fd.uid !== process.getuid() ||
    fd.dev !== named.dev ||
    fd.ino !== named.ino ||
    fs.realpathSync(file) !== file ||
    fs.realpathSync("/proc/self/fd/3") !== file ||
    !/^lock:\s+\d+:\s+FLOCK\s+ADVISORY\s+WRITE\s+\d+\s+[0-9a-f]+:[0-9a-f]+:\d+\s+0\s+EOF$/m.test(
      fs.readFileSync("/proc/self/fdinfo/3", "utf8"),
    )
  )
    throw Error("Unverified receiver content lock");
  fs.fchmodSync(3, 0o600);
}
async function contentConfiguration(config, required) {
  let configured = false;
  const values = [];
  for (const name of ["runtime.env", "maintenance.env"]) {
    const file = path.join(config.root, "private", name);
    try {
      const env = parseEnv(await readFile(file, "utf8"));
      values.push({ file, env });
      if (env.BIBI_CONTENT_ROOT) configured = true;
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
  }
  if (!configured && !required) return false;
  if (values.length !== 2) throw Error("Fixed private content configuration required");
  for (const { file, env } of values) {
    const stat = await lstat(file);
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      (await realpath(file)) !== path.resolve(file) ||
      (process.platform !== "win32" &&
        ((stat.mode & 0o077) !== 0 || stat.uid !== process.getuid())) ||
      env.BIBI_CONTENT_ROOT !== path.join(config.root, "content") ||
      env.BIBI_CONTENT_ASSET_ROOT !== config.site
    )
      throw Error("Invalid fixed private content configuration");
  }
  const relation = path.relative(path.resolve(config.site), path.resolve(config.root));
  if (!relation || (!relation.startsWith("..") && !path.isAbsolute(relation)))
    throw Error("Private content must be outside webroot");
  return true;
}
async function prepareContentBackup(config, current, candidate, { run } = {}) {
  if (!(await contentConfiguration(config, !!candidate?.manifest?.content))) return;
  const capable = [candidate, current].find(
    (r) => r?.manifest?.content || r?.manifest?.contentPublic,
  );
  if (!capable) throw Error("Content-compatible backup tool required");
  await require("./content-metadata.cjs").verifyContentAssets(capable.dir, capable.manifest);
  const receipt = await (run ?? require("./database-lifecycle.cjs").runDatabaseTool)(
    config,
    capable.dir,
    "content-backup",
    capable.manifest,
  );
  if (
    receipt?.verified !== true ||
    receipt.profiles !== true ||
    receipt.content !== true ||
    !/^[a-f0-9]{64}$/.test(receipt.sha256 ?? "") ||
    !/^[a-f0-9]{64}$/.test(receipt.contentManifestSha256 ?? "") ||
    !Number.isSafeInteger(receipt.bytes) ||
    receipt.bytes < 1
  )
    throw Error("Verified paired content backup/restore required");
  return receipt;
}
module.exports = { assertReceiverContentLock, contentConfiguration, prepareContentBackup };
