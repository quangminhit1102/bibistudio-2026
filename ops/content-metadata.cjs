"use strict";
const { createHash } = require("node:crypto");
const { lstat, readFile, readdir, realpath } = require("node:fs/promises");
const { join, resolve } = require("node:path");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const hex = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const assetPath = (value) =>
  /^\/assets\/[a-zA-Z0-9][a-zA-Z0-9_.-]*\.(?:js|css|woff2?|png|jpe?g|webp|svg|ico)$/.test(value);
async function regular(file) {
  const info = await lstat(file);
  if (
    !info.isFile() ||
    info.isSymbolicLink() ||
    info.size > 64 * 1024 ** 2 ||
    (await realpath(file)) !== resolve(file)
  )
    throw Error("Invalid content release file");
  return readFile(file);
}
async function treeHash(directory) {
  const h = createHash("sha256");
  let count = 0;
  async function walk(dir, prefix = "") {
    const info = await lstat(dir);
    if (!info.isDirectory() || info.isSymbolicLink() || (await realpath(dir)) !== resolve(dir))
      throw Error("Invalid content release directory");
    for (const name of (await readdir(dir)).sort()) {
      if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(name) || ++count > 10000)
        throw Error("Invalid content release tree");
      const file = join(dir, name),
        relative = prefix + name,
        stat = await lstat(file);
      if (stat.isDirectory()) await walk(file, relative + "/");
      else h.update(relative + "\n" + hash(await regular(file)) + "\n");
    }
  }
  await walk(directory);
  if (!count) throw Error("Empty content release directory");
  return h.digest("hex");
}
function validateContentPublicMetadata(data) {
  if (
    !data ||
    Object.keys(data).sort().join() !==
      "assetChecksums,assetManifestSha256,maintenanceSha256,readModelVersion,readerSha256,readerVersion,rendererSha256" ||
    data.readerVersion !== 1 ||
    data.readModelVersion !== 1 ||
    !hex(data.readerSha256) ||
    !hex(data.assetManifestSha256) ||
    !hex(data.rendererSha256) ||
    !hex(data.maintenanceSha256) ||
    !data.assetChecksums ||
    typeof data.assetChecksums !== "object" ||
    Array.isArray(data.assetChecksums) ||
    !Object.keys(data.assetChecksums).length ||
    Object.keys(data.assetChecksums).length > 10000 ||
    Object.entries(data.assetChecksums).some(([key, value]) => !assetPath(key) || !hex(value))
  )
    throw Error("Invalid content public release metadata");
  return {
    readerVersion: 1,
    readModelVersion: 1,
    readerSha256: data.readerSha256,
    rendererSha256: data.rendererSha256,
    maintenanceSha256: data.maintenanceSha256,
    assetManifestSha256: data.assetManifestSha256,
    assetChecksums: Object.fromEntries(
      Object.entries(data.assetChecksums).sort(([a], [b]) => a.localeCompare(b)),
    ),
  };
}
function validateContentMetadata(data) {
  if (
    !data ||
    Object.keys(data).sort().join() !==
      "assetChecksums,assetManifestSha256,maintenanceSha256,migrationChecksums,mode,publicReaderVersion,readModelVersion,readerSha256,readerVersion,rendererSha256,schemaVersion,seedSha256" ||
    data.schemaVersion !== 1 ||
    data.mode !== "cms" ||
    data.publicReaderVersion !== 1 ||
    Object.keys(data.migrationChecksums ?? {}).join() !== "001_content.sql" ||
    !hex(data.migrationChecksums["001_content.sql"]) ||
    !hex(data.seedSha256)
  )
    throw Error("Invalid content release metadata");
  const { schemaVersion, mode, publicReaderVersion, migrationChecksums, seedSha256, ...pub } = data;
  return {
    schemaVersion: 1,
    mode: "cms",
    publicReaderVersion: 1,
    ...validateContentPublicMetadata(pub),
    migrationChecksums: { "001_content.sql": migrationChecksums["001_content.sql"] },
    seedSha256,
  };
}
async function createContentMetadata(bundle, mode) {
  if (!["bridge", "cms"].includes(mode)) throw Error("Invalid committed content release mode");
  const backend = join(bundle, "backend"),
    descriptor = await regular(join(backend, "content-assets.json")),
    assets = JSON.parse(descriptor.toString("utf8"));
  if (
    assets.schemaVersion !== 1 ||
    assets.rendererVersion !== "content-doc-v1" ||
    !Array.isArray(assets.assets) ||
    !assets.assets.length ||
    new Set(assets.assets).size !== assets.assets.length ||
    assets.assets.some((path) => !assetPath(path)) ||
    !assets.assets.includes(assets.script) ||
    !assets.script.endsWith(".js") ||
    !Array.isArray(assets.css) ||
    !assets.css.length ||
    assets.css.some((p) => !p.endsWith(".css") || !assets.assets.includes(p))
  )
    throw Error("Invalid content public asset descriptor");
  const assetChecksums = {};
  for (const path of assets.assets.slice().sort())
    assetChecksums[path] = hash(await regular(join(bundle, "frontend", path.slice(1))));
  const pub = validateContentPublicMetadata({
    readerVersion: 1,
    readModelVersion: 1,
    readerSha256: hash(await regular(join(backend, "content-public/content-reader.php"))),
    rendererSha256: await treeHash(join(backend, "dist/content")),
    maintenanceSha256: hash(
      (await treeHash(join(backend, "content-migrations"))) +
        "\n" +
        (await treeHash(join(backend, "content-seed"))),
    ),
    assetManifestSha256: hash(descriptor),
    assetChecksums,
  });
  if (mode === "bridge") return pub;
  if ((await readdir(join(backend, "content-migrations"))).sort().join() !== "001_content.sql")
    throw Error("Unknown content SQL assets");
  return validateContentMetadata({
    schemaVersion: 1,
    mode: "cms",
    publicReaderVersion: 1,
    ...pub,
    migrationChecksums: {
      "001_content.sql": hash(await regular(join(backend, "content-migrations/001_content.sql"))),
    },
    seedSha256: await treeHash(join(backend, "content-seed")),
  });
}
async function verifyContentAssets(bundle, manifest) {
  const mode = manifest.content ? "cms" : "bridge",
    expected = manifest.content ?? manifest.contentPublic;
  if (!expected) return;
  const validated =
    mode === "cms" ? validateContentMetadata(expected) : validateContentPublicMetadata(expected);
  if (JSON.stringify(await createContentMetadata(bundle, mode)) !== JSON.stringify(validated))
    throw Error("Content release asset checksum mismatch");
}
function checkContentCompatibility(metadata, status) {
  const m = validateContentMetadata(metadata);
  if (
    status?.state !== "complete" ||
    status.version !== 1 ||
    JSON.stringify(status.migrationChecksums) !== JSON.stringify(m.migrationChecksums)
  )
    throw Error("Incompatible content schema/checksum");
}
module.exports = {
  createContentMetadata,
  validateContentMetadata,
  validateContentPublicMetadata,
  verifyContentAssets,
  checkContentCompatibility,
};
