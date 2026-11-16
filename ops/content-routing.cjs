"use strict";
const fs = require("node:fs/promises"),
  path = require("node:path"),
  { createHash, randomUUID } = require("node:crypto");
const digest = (value) => createHash("sha256").update(value).digest("hex");
const begin = "# BIBI CONTENT BEGIN\n",
  end = "# BIBI CONTENT END\n";
function contentRoutingBlock() {
  return (
    begin +
    "  RewriteRule ^(?:blog(?:/.*)?|sitemap\\.xml/?|sitemaps/blog\\.xml/?|media/content(?:/.*)?|_bibi-content(?:/.*)?)$ _bibi-content/reader.php [END]\n" +
    end
  );
}
function splitRules(rules) {
  const start = rules.indexOf(begin);
  if (start === -1) {
    if (rules.includes(end.trim())) throw Error("Invalid content routing block");
    return { base: rules, block: null };
  }
  const finish = rules.indexOf(end, start);
  if (finish === -1 || rules.indexOf(begin, start + begin.length) !== -1)
    throw Error("Invalid content routing block");
  const block = rules.slice(start, finish + end.length);
  return { base: rules.slice(0, start) + rules.slice(finish + end.length), block };
}
async function regular(file) {
  const info = await fs.lstat(file);
  if (!info.isFile() || info.isSymbolicLink() || (await fs.realpath(file)) !== path.resolve(file))
    throw Error("Invalid content routing file");
  return fs.readFile(file, "utf8");
}
async function optional(file) {
  try {
    return await regular(file);
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
}
async function directory(dir, mode) {
  try {
    const info = await fs.lstat(dir);
    if (
      !info.isDirectory() ||
      info.isSymbolicLink() ||
      (await fs.realpath(dir)) !== path.resolve(dir)
    )
      throw Error("Invalid content routing directory");
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    await fs.mkdir(dir, { mode });
  }
}
async function atomic(file, bytes, mode) {
  const next = file + ".new-" + randomUUID();
  try {
    const f = await fs.open(next, "wx", mode);
    try {
      await f.writeFile(bytes);
      await f.sync();
    } finally {
      await f.close();
    }
    await fs.rename(next, file);
  } finally {
    await fs.unlink(next).catch((e) => {
      if (e.code !== "ENOENT") throw e;
    });
  }
}
function outside(site, target) {
  const rel = path.relative(path.resolve(site), path.resolve(target));
  if (!rel || (!rel.startsWith("..") && !path.isAbsolute(rel)))
    throw Error("Private content must be outside webroot");
}
async function configuration(config) {
  if (
    !path.isAbsolute(config.root) ||
    !path.isAbsolute(config.site) ||
    !/^[a-f0-9]{64}$/.test(config.expectedRootSha256 ?? "")
  )
    throw Error("Trusted content routing root hash required");
  outside(config.site, config.root);
  for (const dir of [config.root, config.site, path.join(config.root, "private")])
    await directory(dir, 0o700);
  const file = path.join(config.root, "private/content-reader.json"),
    info = await fs.lstat(file),
    json = JSON.parse(await regular(file));
  if (process.platform !== "win32" && ((info.mode & 0o077) !== 0 || info.uid !== process.getuid()))
    throw Error("Private content reader config must be owned mode0600");
  if (
    Object.keys(json).sort().join() !== "canonicalOrigin,contentRoot,environment,schemaVersion" ||
    json.schemaVersion !== 1 ||
    !["local", "production"].includes(json.environment) ||
    json.contentRoot !== path.join(config.root, "content")
  )
    throw Error("Invalid content reader config");
  const origin = new URL(json.canonicalOrigin);
  if (
    origin.origin !== json.canonicalOrigin ||
    origin.username ||
    origin.password ||
    (json.environment === "production"
      ? json.canonicalOrigin !== "https://bibistudio.vn"
      : origin.protocol !== "https:" &&
        !(
          origin.protocol === "http:" &&
          ["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname)
        ))
  )
    throw Error("Invalid canonical content origin");
  await directory(json.contentRoot, 0o700);
  return json;
}
const quote = (value) => "'" + value.replaceAll("\\", "/").replaceAll("'", "\\'") + "'";
async function managed(config) {
  return {
    root: path.join(config.site, ".htaccess"),
    loader: path.join(config.site, "_bibi-content/reader.php"),
    reader: path.join(config.root, "public-reader/content-reader.php"),
    state: path.join(config.root, "private/content-routing.json"),
  };
}
async function assertOwned(files, state, split) {
  if (split.block && (!state || digest(split.block) !== state.blockSha256))
    throw Error("Modified owned content routing block");
  for (const key of ["loader", "reader"]) {
    const bytes = await optional(files[key]);
    if (bytes !== null && (!state || digest(bytes) !== state.files?.[key]))
      throw Error("Modified owned content reader checksum");
  }
}
async function installContentRouting(config) {
  await configuration(config);
  const files = await managed(config),
    original = await regular(files.root),
    split = splitRules(original),
    previous = await optional(files.state),
    state = previous ? JSON.parse(previous) : null;
  if (digest(split.base) !== config.expectedRootSha256) throw Error("Unexpected root routing hash");
  await assertOwned(files, state, split);
  if (!/^\s*RewriteEngine On\r?$/m.test(split.base)) throw Error("Root routing anchor missing");
  const block = contentRoutingBlock(),
    rules = split.base.replace(/^(\s*RewriteEngine On\r?\n)/m, "$1" + block),
    reader = await fs.readFile(path.join(__dirname, "php/content-reader.php"), "utf8"),
    loader =
      "<?php\ndefine('BIBI_CONTENT_CONFIG_FILE', " +
      quote(path.join(config.root, "private/content-reader.json")) +
      ");\nrequire " +
      quote(files.reader) +
      ";\n",
    nextState = {
      schemaVersion: 1,
      baseSha256: config.expectedRootSha256,
      blockSha256: digest(block),
      files: { loader: digest(loader), reader: digest(reader) },
    };
  if (state && split.block === block && JSON.stringify(state) === JSON.stringify(nextState))
    return { schemaVersion: 1, changed: false, backup: null, ...nextState };
  const backup = path.join(config.root, "private", "content-routing-backup-" + randomUUID());
  await fs.mkdir(backup, { mode: 0o700 });
  const originals = {
    root: original,
    loader: await optional(files.loader),
    reader: await optional(files.reader),
    state: previous,
  };
  const backupBytes = JSON.stringify(originals);
  await fs.writeFile(path.join(backup, "before.json"), backupBytes, {
    flag: "wx",
    mode: 0o600,
  });
  for (const dir of [path.dirname(files.reader), path.dirname(files.loader)])
    await directory(dir, 0o755);
  const intended = { reader, loader, root: rules, state: JSON.stringify(nextState) };
  try {
    for (const key of ["reader", "loader", "root", "state"])
      await atomic(files[key], intended[key], key === "loader" || key === "root" ? 0o644 : 0o600);
  } catch (error) {
    try {
      for (const key of ["root", "loader", "reader", "state"]) {
        const actual = await optional(files[key]);
        if (actual !== null && actual !== intended[key] && actual !== originals[key])
          throw Error("Owned routing changed during recovery");
        if (originals[key] === null) {
          if (actual !== null) await fs.unlink(files[key]);
        } else
          await atomic(
            files[key],
            originals[key],
            key === "loader" || key === "root" ? 0o644 : 0o600,
          );
      }
    } catch {
      throw Error("Content routing recovery required; inspect private backup");
    }
    throw error;
  }
  return {
    schemaVersion: 1,
    changed: true,
    backup,
    backupSha256: digest(backupBytes),
    ...nextState,
  };
}
async function uninstallContentRouting(config, receipt) {
  await configuration(config);
  const files = await managed(config),
    state = JSON.parse(await regular(files.state)),
    rules = await regular(files.root),
    split = splitRules(rules);
  await assertOwned(files, state, split);
  if (
    !split.block ||
    state.blockSha256 !== receipt.blockSha256 ||
    JSON.stringify(state.files) !== JSON.stringify(receipt.files)
  )
    throw Error("Content routing receipt mismatch");
  if (
    !receipt.backup ||
    path.dirname(receipt.backup) !== path.join(config.root, "private") ||
    !/^content-routing-backup-[a-f0-9-]{36}$/.test(path.basename(receipt.backup))
  )
    throw Error("Invalid owned routing backup");
  const backupBytes = await regular(path.join(receipt.backup, "before.json"));
  if (digest(backupBytes) !== receipt.backupSha256)
    throw Error("Modified owned routing backup checksum");
  const before = JSON.parse(backupBytes),
    previousBlock = splitRules(before.root).block;
  // Preserve external rules added outside our block; never restore a whole stale root file.
  await atomic(
    files.root,
    previousBlock
      ? split.base.replace(/^(\s*RewriteEngine On\r?\n)/m, "$1" + previousBlock)
      : split.base,
    0o644,
  );
  for (const key of ["loader", "reader", "state"]) {
    if (before[key] === null) await fs.unlink(files[key]);
    else await atomic(files[key], before[key], key === "loader" ? 0o644 : 0o600);
  }
}
async function verifyContentRouting(config) {
  const files = await managed(config),
    state = JSON.parse(await regular(files.state));
  if (
    state.schemaVersion !== 1 ||
    !/^[a-f0-9]{64}$/.test(state.baseSha256 ?? "") ||
    state.blockSha256 !== digest(contentRoutingBlock())
  )
    throw Error("Invalid owned content routing receipt");
  await configuration({ ...config, expectedRootSha256: state.baseSha256 });
  const split = splitRules(await regular(files.root));
  if (split.block !== contentRoutingBlock()) throw Error("Missing owned content routing block");
  await assertOwned(files, state, split);
  return { readerVersion: 1, readModelVersion: 1 };
}
module.exports = {
  installContentRouting,
  uninstallContentRouting,
  contentRoutingBlock,
  verifyContentRouting,
};
