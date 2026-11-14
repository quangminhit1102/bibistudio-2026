"use strict";
const fs = require("node:fs/promises"),
  path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");
const { parseEnv } = require("node:util");
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function regular(file, privateFile = false) {
  const info = await fs.lstat(file);
  if (
    !info.isFile() ||
    info.isSymbolicLink() ||
    (privateFile &&
      process.platform !== "win32" &&
      ((info.mode & 0o077) !== 0 || info.uid !== process.getuid()))
  )
    throw new Error("Unsafe relay configuration or routing file");
  return fs.readFile(file, "utf8");
}
function outside(site, target) {
  const relation = path.relative(path.resolve(site), path.resolve(target));
  if (!relation || (!relation.startsWith("..") && !path.isAbsolute(relation)))
    throw new Error("Relay configuration must be outside webroot");
}
async function validateRelayConfiguration(config) {
  const privateDir = path.join(config.root, "private");
  outside(config.site, privateDir);
  const json = JSON.parse(await regular(path.join(privateDir, "analytics-relay.json"), true));
  if (
    Object.keys(json).sort().join() !== "environment,origins,secret,targetUrl" ||
    json.environment !== "production" ||
    !/^[A-Za-z0-9_-]{43}$/.test(json.secret ?? "") ||
    Buffer.from(json.secret, "base64url").toString("base64url") !== json.secret ||
    json.targetUrl !== new URL("/api/analytics/collect", config.baseUrl).href ||
    new URL(json.targetUrl).protocol !== "https:" ||
    !Array.isArray(json.origins) ||
    json.origins.length < 1 ||
    json.origins.some(
      (o) => typeof o !== "string" || new URL(o).origin !== o || new URL(o).protocol !== "https:",
    )
  )
    throw new Error("Invalid private relay configuration");
  const expectedGeo = path.join(config.root, "current/backend/geoip/country.mmdb");
  for (const name of ["runtime.env", "maintenance.env"]) {
    const env = parseEnv(await regular(path.join(privateDir, name), true));
    if (
      env.ANALYTICS_RELAY_SECRET !== json.secret ||
      env.GEOIP_COUNTRY_FILE !== expectedGeo ||
      [
        env.AUTH_JWT_SECRET,
        env.ANALYTICS_ID_SECRET,
        env.RELEASE_PROBE_SECRET,
        env.RELEASE_PROBE_PASSWORD,
      ].includes(json.secret) ||
      env.CLIENT_IP_SOURCE_VERIFIED !== "false" ||
      JSON.stringify((env.AUTH_ALLOWED_ORIGINS ?? "").split(",").filter(Boolean).sort()) !==
        JSON.stringify([...json.origins].sort())
    )
      throw new Error("Relay runtime/maintenance configuration mismatch");
  }
}
async function atomic(file, bytes, mode) {
  const next = file + ".new-" + randomUUID();
  try {
    await fs.writeFile(next, bytes, { mode, flag: "wx" });
    await fs.rename(next, file);
  } finally {
    await fs.rm(next, { force: true });
  }
}
async function directory(dir) {
  try {
    const info = await fs.lstat(dir);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("Unexpected relay directory");
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    await fs.mkdir(dir, { mode: 0o755 });
  }
}
async function optional(file) {
  try {
    return await regular(file);
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
}
async function installRelayRouting(config) {
  outside(config.site, path.join(config.root, "private"));
  const child = path.join(config.site, "api/analytics/relay");
  for (const dir of [
    config.site,
    path.join(config.site, "api"),
    path.join(config.site, "api/analytics"),
    child,
  ])
    await directory(dir);
  const phpRoot = path.resolve(config.root).replaceAll("\\", "/").replaceAll("'", "\\'");
  const loader = (await fs.readFile(path.join(__dirname, "php/loader.php"), "utf8")).replace(
    "__BIBI_DEPLOY_ROOT__",
    "'" + phpRoot + "'",
  );
  const rules = await fs.readFile(path.join(__dirname, "php/relay.htaccess"), "utf8");
  const stateFile = path.join(config.root, "private/analytics-relay-routing.json");
  const previous = await optional(stateFile);
  const state = previous ? JSON.parse(previous) : null;
  const originals = {};
  for (const name of ["collect.php", ".htaccess"]) {
    originals[name] = await optional(path.join(child, name));
    if (originals[name] !== null && (!state || digest(originals[name]) !== state.files?.[name]))
      throw new Error("Unexpected or modified analytics relay routing");
  }
  const files = { "collect.php": digest(loader), ".htaccess": digest(rules) };
  if (state && JSON.stringify(state.files) === JSON.stringify(files)) return;
  // Back up even the absent state before writing either child file. Parent routing is untouched.
  const backup = path.join(config.root, "private", "relay-routing-backup-" + randomUUID());
  await fs.mkdir(backup, { mode: 0o700 });
  await fs.writeFile(
    path.join(backup, "before.json"),
    JSON.stringify({ files: originals, state }),
    { mode: 0o600, flag: "wx" },
  );
  await atomic(path.join(child, "collect.php"), loader, 0o644);
  await atomic(path.join(child, ".htaccess"), rules, 0o644);
  await atomic(stateFile, JSON.stringify({ version: 1, files }), 0o600);
}
async function verifyRelayRouting(config, request = fetch) {
  const response = await request(new URL("/api/analytics/relay/collect.php", config.baseUrl), {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(6000),
  });
  if (
    response.status !== 405 ||
    !response.headers.get("content-type")?.includes("application/json") ||
    (await response.json())?.error?.code !== "ANALYTICS_RELAY_REJECTED"
  )
    throw new Error("PHP collector routing readiness failed");
}
module.exports = { validateRelayConfiguration, installRelayRouting, verifyRelayRouting };
