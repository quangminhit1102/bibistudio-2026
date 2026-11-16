"use strict";
const fs = require("node:fs/promises"),
  path = require("node:path"),
  { createHash, randomUUID } = require("node:crypto");
const { verifyContentAssets } = require("./content-metadata.cjs");
const { prepareContentBackup } = require("./content-backup.cjs");
const {
  installContentRouting,
  uninstallContentRouting,
  verifyContentRouting,
} = require("./content-routing.cjs");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function exists(file) {
  try {
    await fs.lstat(file);
    return true;
  } catch (e) {
    if (e.code === "ENOENT") return false;
    throw e;
  }
}
async function regular(file, max = 65536) {
  const stat = await fs.lstat(file);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    stat.size > max ||
    (await fs.realpath(file)) !== path.resolve(file)
  )
    throw Error("Unsafe initial cutover receipt");
  return fs.readFile(file, "utf8");
}
async function saveReceipt(config, receipt) {
  const file = path.join(config.root, "private/content-initial-routing.json"),
    next = file + "." + randomUUID();
  const h = await fs.open(next, "wx", 0o600);
  try {
    await h.writeFile(JSON.stringify(receipt));
    await h.sync();
  } finally {
    await h.close();
  }
  try {
    await fs.rename(next, file);
  } finally {
    await fs.unlink(next).catch((e) => {
      if (e.code !== "ENOENT") throw e;
    });
  }
  if (process.platform !== "win32") {
    const dir = await fs.open(path.dirname(file), "r");
    try {
      await dir.sync();
    } finally {
      await dir.close();
    }
  }
}
async function recoverRoutingReceipt(config, installed) {
  if (installed.changed) return installed;
  try {
    const receipt = JSON.parse(
      await regular(path.join(config.root, "private/content-initial-routing.json")),
    );
    if (
      receipt.baseSha256 !== config.contentRoutingBaseSha256 ||
      receipt.blockSha256 !== installed.blockSha256 ||
      JSON.stringify(receipt.files) !== JSON.stringify(installed.files)
    )
      throw Error("Initial routing receipt mismatch");
    return receipt;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  // A crash may occur after the installer commits but before its caller saves the
  // receipt. Only an exact audited, pre-cutover backup can reconstruct ownership.
  const directory = path.join(config.root, "private");
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (
      !entry.isDirectory() ||
      entry.isSymbolicLink() ||
      !/^content-routing-backup-[a-f0-9-]{36}$/.test(entry.name)
    )
      continue;
    const backup = path.join(directory, entry.name),
      bytes = await regular(path.join(backup, "before.json")),
      before = JSON.parse(bytes);
    if (
      typeof before.root === "string" &&
      hash(before.root) === config.contentRoutingBaseSha256 &&
      before.loader === null &&
      before.reader === null &&
      before.state === null
    )
      return { ...installed, changed: true, backup, backupSha256: hash(bytes) };
  }
  throw Error("Initial content routing recovery required; preserve current generation");
}
async function initializeContent(config, current, candidate, { run } = {}) {
  if (!candidate?.manifest?.content || !config.root) return;
  await verifyContentAssets(candidate.dir, candidate.manifest);
  const execute = run ?? require("./database-lifecycle.cjs").runDatabaseTool;
  const invoke = (action) =>
    execute(config, candidate.dir, "content-initial-" + action, candidate.manifest);
  const status = await invoke("status");
  if (!["absent", "prepared", "activated", "committed", "failed"].includes(status?.state))
    throw Error("Unknown initial content state; activation forbidden");
  if (status?.initialized === true) {
    await verifyContentRouting(config);
    return status;
  }
  const pending = ["prepared", "activated"].includes(status?.state);
  if (
    (status?.committed && !status.activeGenerationId) ||
    (!pending &&
      (status?.activeGenerationId ||
        (await exists(path.join(config.root, "private/content-routing.json")))))
  )
    throw Error("Missing or unrelated initial public content; recovery required");
  if (
    current?.manifest?.contentPublic?.readerVersion !== 1 ||
    current.manifest.contentPublic.readModelVersion !== 1
  )
    throw Error("Verified reader-compatible bridge required before initial cutover");
  if (!/^[a-f0-9]{64}$/.test(config.contentRoutingBaseSha256 ?? ""))
    throw Error("Audited initial content routing checksum required");
  if (
    hash(await fs.readFile(path.join(__dirname, "php/content-reader.php"))) !==
    candidate.manifest.content.readerSha256
  )
    throw Error("Reviewed stable reader does not match candidate content checksum");
  await prepareContentBackup(config, current, candidate, { run: execute });
  let prepared, receipt;
  try {
    prepared = await invoke("prepare");
    if (
      !/^[a-f0-9-]{36}$/.test(prepared?.generationId ?? "") ||
      !/^[a-f0-9]{64}$/.test(prepared?.manifestSha256 ?? "")
    )
      throw Error("Invalid initial generation preparation");
    const active = await invoke("activate");
    if (active?.generationId !== prepared.generationId)
      throw Error("Initial content activation identity mismatch");
    const installed = await installContentRouting({
      ...config,
      expectedRootSha256: config.contentRoutingBaseSha256,
    });
    receipt = await recoverRoutingReceipt(config, installed);
    await saveReceipt(config, receipt);
    const verified = await invoke("verify");
    if (verified?.committed !== true || verified.generationId !== prepared.generationId)
      throw Error("Initial public canary not committed");
    return verified;
  } catch {
    let latest;
    try {
      latest = await invoke("status");
    } catch {
      throw Error(
        "Initial content cutover recovery required; current routing and pointer retained",
      );
    }
    if (latest?.committed)
      throw Error("Initial content is committed; canary/finalization recovery required");
    if (prepared) {
      // If ownership cannot be recovered, retain the complete generation instead
      // of removing its pointer while native routing may still be installed.
      if (!receipt && (await exists(path.join(config.root, "private/content-routing.json"))))
        throw Error("Initial content routing recovery required; current generation retained");
      try {
        if (receipt)
          await uninstallContentRouting(
            { ...config, expectedRootSha256: config.contentRoutingBaseSha256 },
            receipt,
          );
        const restored = await invoke("restore");
        if (restored?.restored !== true || restored.generationId !== prepared.generationId)
          throw Error();
      } catch {
        throw Error("Initial content cutover recovery required; inspect paired backup");
      }
    }
    throw Error("Initial content cutover failed; previous routing and pointer restored");
  }
}
module.exports = { initializeContent };
