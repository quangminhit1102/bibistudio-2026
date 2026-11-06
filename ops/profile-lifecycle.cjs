"use strict";
const fs = require("node:fs/promises"),
  path = require("node:path");
const { parseEnv } = require("node:util");
const { verifyProfileAssets, checkProfileCompatibility } = require("./profile-metadata.cjs");
async function exists(file) {
  try {
    await fs.lstat(file);
    return true;
  } catch (e) {
    if (e.code === "ENOENT") return false;
    throw e;
  }
}
async function profilesConfigured(config) {
  if (
    (await exists(path.join(config.root, "private/profile-feature-enabled"))) ||
    (await exists(path.join(config.root, "private/profile-assets")))
  )
    return true;
  for (const name of ["runtime.env", "maintenance.env"]) {
    try {
      if (
        Object.hasOwn(
          parseEnv(await fs.readFile(path.join(config.root, "private", name), "utf8")),
          "PROFILE_ASSET_DIR",
        )
      )
        return true;
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
  }
  return false;
}
async function validateProfileConfiguration(config) {
  const fixed = path.resolve(config.root, "private/profile-assets");
  if (config.site) {
    const relation = path.relative(path.resolve(config.site), fixed);
    if (!relation || (!relation.startsWith("..") && !path.isAbsolute(relation)))
      throw new Error("Profile directory must be outside webroot");
  }
  for (const name of ["runtime.env", "maintenance.env"]) {
    const file = path.join(config.root, "private", name),
      info = await fs.lstat(file);
    if (
      !info.isFile() ||
      info.isSymbolicLink() ||
      (process.platform !== "win32" && ((info.mode & 0o077) !== 0 || info.uid !== process.getuid()))
    )
      throw new Error("Unsafe profile private configuration");
    const env = parseEnv(await fs.readFile(file, "utf8"));
    if (
      !env.PROFILE_ASSET_DIR ||
      env.PROFILE_ASSET_DIR !== env.PROFILE_ASSET_DIR.trim() ||
      !path.isAbsolute(env.PROFILE_ASSET_DIR) ||
      path.resolve(env.PROFILE_ASSET_DIR) !== fixed
    )
      throw new Error("Runtime and maintenance must use the same fixed private profile directory");
  }
}
async function prepareProfileLifecycle(config, current, candidate, { run } = {}) {
  const capable = [candidate, current].find((release) => release?.manifest?.profiles);
  if (!capable) {
    if (await profilesConfigured(config))
      throw new Error(
        "Profile data/config exists but no profile-aware release tool; activation/rollback forbidden",
      );
    return undefined;
  }
  await validateProfileConfiguration(config);
  await verifyProfileAssets(path.join(capable.dir, "backend"), capable.manifest.profiles);
  const execute = run ?? require("./database-lifecycle.cjs").runDatabaseTool;
  const status = await execute(config, capable.dir, "profile-status", capable.manifest);
  if (!["empty", "complete"].includes(status?.state))
    throw new Error("Unknown/dirty profile schema");
  if (status.state === "complete") checkProfileCompatibility(capable.manifest.profiles, status);
  const receipt = await execute(config, capable.dir, "profile-backup", capable.manifest);
  if (
    receipt?.verified !== true ||
    receipt.profiles !== true ||
    !Number.isSafeInteger(receipt.assetCount) ||
    receipt.assetCount < 0 ||
    !/^[a-f0-9]{64}$/.test(receipt.manifestSha256 ?? "") ||
    !/^[a-f0-9]{64}$/.test(receipt.sha256 ?? "") ||
    !Number.isSafeInteger(receipt.bytes) ||
    receipt.bytes < 1
  )
    throw new Error("Verified paired profile backup required");
  await fs.mkdir(path.join(config.root, "private"), { recursive: true, mode: 0o700 });
  await fs
    .writeFile(path.join(config.root, "private/profile-feature-enabled"), "1\n", {
      flag: "wx",
      mode: 0o600,
    })
    .catch((e) => {
      if (e.code !== "EEXIST") throw e;
    });
  return receipt;
}
module.exports = { prepareProfileLifecycle, profilesConfigured };
