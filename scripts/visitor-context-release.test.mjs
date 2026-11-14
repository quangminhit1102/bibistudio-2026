import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, cp, writeFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
const require = createRequire(import.meta.url);
const context = () => require("../ops/visitor-context-metadata.cjs");
async function metadata() {
  const b = resolve("backend");
  return Promise.all([
    require("../ops/database-metadata.cjs").createDatabaseMetadata(b),
    require("../ops/access-log-metadata.cjs").createAccessLogMetadata(b),
    require("../ops/profile-metadata.cjs").createProfileMetadata(b),
    require("../ops/visitor-metadata.cjs").createVisitorMetadata(b),
  ]);
}
test("manifest6 requires exact context assets and retains manifest1 to5 compatibility", async () => {
  const { makeManifest, validateManifest } = require("../ops/release.cjs");
  const prior = await metadata();
  const feature = await context().createVisitorContextMetadata(resolve("backend"));
  for (let n = 0; n <= 4; n++) {
    const m = makeManifest("a".repeat(40), "10", ...prior.slice(0, n));
    assert.equal(m.schemaVersion, n + 1);
    assert.deepEqual(validateManifest(m), m);
  }
  const m = makeManifest("a".repeat(40), "11", ...prior, feature);
  assert.equal(m.schemaVersion, 6);
  assert.deepEqual(validateManifest(m), m);
  assert.throws(() => validateManifest({ ...m, visitorContext: undefined }));
  assert.throws(() => validateManifest({ ...m, visitorAnalytics: undefined }));
  assert.throws(() => context().validateVisitorContextMetadata({ ...feature, relaySha256: "bad" }));
  await context().verifyVisitorContextAssets(resolve("backend"), feature);
});
test("release context rejects altered PHP, MMDB and SQL before activation", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "bibi-context-assets-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const name of ["relay", "geoip", "visitor-context-migrations"])
    await cp(join("backend", name), join(dir, name), { recursive: true });
  const c = context(),
    m = await c.createVisitorContextMetadata(dir);
  await c.verifyVisitorContextAssets(dir, m);
  for (const name of [
    "relay/context.php",
    "geoip/country.mmdb",
    "visitor-context-migrations/001_context.sql",
  ]) {
    await writeFile(join(dir, name), "tampered");
    await assert.rejects(c.verifyVisitorContextAssets(dir, m));
    await cp(join("backend", name), join(dir, name));
  }
  await rm(join(dir, "relay/collect.php"));
  await assert.rejects(c.verifyVisitorContextAssets(dir, m));
});
test("context lifecycle requires paired backup, migrates before activation and uses only current/candidate tools", async () => {
  const { prepareVisitorContext } = require("../ops/visitor-context-lifecycle.cjs");
  const m = await context().createVisitorContextMetadata(resolve("backend"));
  const release = { dir: resolve("."), manifest: { visitorContext: m } };
  const calls = [];
  let complete = false;
  const run = async (_c, _d, action) => {
    calls.push(action);
    if (action === "context-migrate") complete = true;
    return {
      state: complete ? "complete" : "empty",
      version: complete ? 1 : 0,
      migrationChecksums: complete ? m.migrationChecksums : {},
    };
  };
  const backupReceipt = { verified: true, profiles: true, sha256: "b".repeat(64), bytes: 1 };
  await assert.rejects(prepareVisitorContext({}, null, release, { run }), /backup/i);
  await prepareVisitorContext({}, null, release, { run, backupReceipt });
  assert.deepEqual(calls, ["context-status", "context-migrate", "context-status"]);
  calls.length = 0;
  await prepareVisitorContext(
    {},
    release,
    { dir: resolve("."), manifest: {} },
    { run, backupReceipt },
  );
  assert.deepEqual(calls, ["context-status"]);
  await assert.rejects(
    prepareVisitorContext({}, null, release, {
      backupReceipt,
      run: async () => ({ state: "dirty" }),
    }),
    /dirty|unknown/i,
  );
});
test("runtime retains schema6 readiness capability from the release manifest", async (t) => {
  const { readRelease } = await import("../backend/dist/release.js");
  const dir = await mkdtemp(join(tmpdir(), "bibi-read-release-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, "manifest.json");
  await writeFile(
    file,
    JSON.stringify({ releaseId: "test", sourceSha: "a".repeat(40), schemaVersion: 6 }),
  );
  const before = process.env.BIBI_RELEASE_MANIFEST;
  process.env.BIBI_RELEASE_MANIFEST = file;
  try {
    assert.equal(readRelease().schemaVersion, 6);
  } finally {
    if (before === undefined) delete process.env.BIBI_RELEASE_MANIFEST;
    else process.env.BIBI_RELEASE_MANIFEST = before;
  }
});
test("relay routing is scoped to one child and refuses unexpected existing PHP without touching parent rules", async (t) => {
  const { installRelayRouting } = require("../ops/visitor-context-routing.cjs");
  const base = await mkdtemp(join(tmpdir(), "bibi-relay-routing-"));
  t.after(() => rm(base, { recursive: true, force: true }));
  const config = {
    root: join(base, "deploy"),
    site: join(base, "site"),
    baseUrl: "https://bibistudio.vn",
  };
  const { mkdir, readFile } = await import("node:fs/promises");
  await mkdir(join(config.site, "api"), { recursive: true });
  await mkdir(join(config.root, "private"), { recursive: true });
  await writeFile(join(config.site, ".htaccess"), "parent");
  await writeFile(join(config.site, "api/.htaccess"), "passenger");
  await installRelayRouting(config);
  await assert.rejects(
    require("../ops/visitor-context-lifecycle.cjs").prepareVisitorContext(config, null, {
      manifest: {},
    }),
    /compatible.*context|context.*tool/i,
  );
  const child = join(config.site, "api/analytics/relay");
  const before = await readFile(join(child, "collect.php"), "utf8");
  assert.ok(before.startsWith("<?php"));
  assert.ok(!before.includes("__BIBI_DEPLOY_ROOT__"));
  assert.match(await readFile(join(child, ".htaccess"), "utf8"), /PassengerEnabled off/);
  await installRelayRouting(config);
  assert.equal(await readFile(join(config.site, ".htaccess"), "utf8"), "parent");
  assert.equal(await readFile(join(config.site, "api/.htaccess"), "utf8"), "passenger");
  await writeFile(join(child, "collect.php"), "unexpected");
  await assert.rejects(installRelayRouting(config), /unexpected|modified/i);
  assert.equal(await readFile(join(child, "collect.php"), "utf8"), "unexpected");
});
test("real PHP loader gates current capability and hash while keeping source private", async (t) => {
  const { readFile, mkdir } = await import("node:fs/promises");
  const { promisify } = await import("node:util");
  const { execFile } = await import("node:child_process");
  const exec = promisify(execFile);
  const dir = await mkdtemp(join(tmpdir(), "bibi-php-loader-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await cp("backend/relay", join(dir, "relay"), { recursive: true });
  const feature = await context().createVisitorContextMetadata(resolve("backend"));
  await writeFile(
    join(dir, "new.json"),
    JSON.stringify({ schemaVersion: 6, visitorContext: feature }),
  );
  await writeFile(join(dir, "old.json"), JSON.stringify({ schemaVersion: 5 }));
  const template = await readFile("ops/php/loader.php", "utf8");
  await writeFile(
    join(dir, "loader.php"),
    template.replace("__BIBI_DEPLOY_ROOT__", "'/tmp/bibi-loader'"),
  );
  await writeFile(
    join(dir, "config.json"),
    JSON.stringify({
      environment: "production",
      targetUrl: "https://example.invalid/api/analytics/collect",
      secret: Buffer.alloc(32, 7).toString("base64url"),
      origins: ["https://example.invalid"],
    }),
    { mode: 0o600 },
  );
  await writeFile(
    join(dir, "driver.php"),
    `<?php
 $root='/tmp/bibi-loader';mkdir($root.'/releases/new/backend/relay',0700,true);mkdir($root.'/private',0700,true);mkdir($root.'/releases/old',0700,true);
 foreach(['collect.php','context.php'] as $name)copy('/fixture/relay/'.$name,$root.'/releases/new/backend/relay/'.$name);
 copy('/fixture/new.json',$root.'/releases/new/manifest.json');copy('/fixture/old.json',$root.'/releases/old/manifest.json');copy('/fixture/config.json',$root.'/private/analytics-relay.json');chmod($root.'/private/analytics-relay.json',0600);
 symlink($root.'/releases/'.($argv[1]==='old'?'old':'new'),$root.'/current');
 if($argv[1]==='tampered')file_put_contents($root.'/releases/new/backend/relay/context.php','<?php echo "source-leak";');
 $_SERVER['REQUEST_METHOD']='GET';register_shutdown_function(function(){echo "\\nstatus=".http_response_code();});require '/fixture/loader.php';
 `,
  );
  for (const [phase, status] of [
    ["new", 405],
    ["old", 404],
    ["tampered", 503],
  ]) {
    const { stdout } = await exec(
      "docker",
      [
        ...(process.platform === "win32" ? ["--context", "desktop-linux"] : []),
        "run",
        "--rm",
        "--read-only",
        "--cap-drop",
        "ALL",
        "--security-opt",
        "no-new-privileges",
        "--user",
        `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`,
        "--tmpfs",
        "/tmp:rw,noexec,nosuid,size=16m,mode=1777",
        "--mount",
        `type=bind,source=${dir},target=/fixture,readonly`,
        (await import("./php-relay.mjs")).PHP_IMAGE,
        "php",
        "/fixture/driver.php",
        phase,
      ],
      {
        env: { ...process.env, DOCKER_API_VERSION: process.env.DOCKER_API_VERSION ?? "1.43" },
        windowsHide: true,
        timeout: 25000,
      },
    );
    assert.match(stdout, new RegExp("status=" + status + "$"));
    assert.ok(!stdout.includes("<?php"));
    assert.ok(!stdout.includes("source-leak"));
    assert.ok(!stdout.includes(Buffer.alloc(32, 7).toString("base64url")));
  }
});
test("private relay configuration requires separate keys, matching origins and trust disabled", async (t) => {
  const { validateRelayConfiguration } = require("../ops/visitor-context-routing.cjs");
  const { mkdir } = await import("node:fs/promises");
  const base = await mkdtemp(join(tmpdir(), "bibi-relay-config-"));
  t.after(() => rm(base, { recursive: true, force: true }));
  const config = {
    root: join(base, "deploy"),
    site: join(base, "site"),
    baseUrl: "https://bibistudio.vn",
  };
  const priv = join(config.root, "private");
  await mkdir(priv, { recursive: true });
  const secret = Buffer.alloc(32, 3).toString("base64url");
  const json = {
    environment: "production",
    secret,
    targetUrl: "https://bibistudio.vn/api/analytics/collect",
    origins: ["https://bibistudio.vn", "https://www.bibistudio.vn"],
  };
  const valid = `ANALYTICS_RELAY_SECRET=${secret}\nGEOIP_COUNTRY_FILE='${join(config.root, "current/backend/geoip/country.mmdb")}'\nAUTH_ALLOWED_ORIGINS=${json.origins.join(",")}\nCLIENT_IP_SOURCE_VERIFIED=false\nAUTH_JWT_SECRET=separate-auth-key\n`;
  const save = async (env = valid, value = json) => {
    await writeFile(join(priv, "analytics-relay.json"), JSON.stringify(value), { mode: 0o600 });
    for (const name of ["runtime.env", "maintenance.env"])
      await writeFile(join(priv, name), env, { mode: 0o600 });
  };
  const parsed = (await import("node:util")).parseEnv(valid);
  assert.equal(parsed.CLIENT_IP_SOURCE_VERIFIED, "false");
  assert.equal(parsed.GEOIP_COUNTRY_FILE, join(config.root, "current/backend/geoip/country.mmdb"));
  assert.equal(parsed.AUTH_ALLOWED_ORIGINS, json.origins.join(","));
  await save();
  await validateRelayConfiguration(config);
  for (const env of [
    valid.replace("false", "true"),
    valid.replace("separate-auth-key", secret),
    valid + `RELEASE_PROBE_SECRET=${secret}\n`,
    valid.replace("https://www.bibistudio.vn", "https://other.invalid"),
  ]) {
    await save(env);
    await assert.rejects(validateRelayConfiguration(config));
  }
  await save(valid, { ...json, targetUrl: "https://other.invalid/api/analytics/collect" });
  await assert.rejects(validateRelayConfiguration(config));
});
test("failed context migration leaves production pointer and parent routing on old release", async (t) => {
  const { mkdir, readFile, symlink, readlink, stat } = await import("node:fs/promises");
  const deploy = require("../ops/deploy.cjs");
  const base = await mkdtemp(join(tmpdir(), "bibi-context-deploy-"));
  t.after(() => rm(base, { recursive: true, force: true }));
  const config = {
    root: join(base, "deploy"),
    site: join(base, "site"),
    baseUrl: "https://bibistudio.vn",
    environment: "production",
  };
  const prior = await metadata(),
    feature = await context().createVisitorContextMetadata(resolve("backend"));
  const { makeManifest } = require("../ops/release.cjs");
  const old = makeManifest("a".repeat(40), "20", ...prior),
    next = makeManifest("b".repeat(40), "21", ...prior, feature);
  const oldDir = join(config.root, "releases", old.releaseId),
    nextDir = join(config.root, "releases", next.releaseId);
  await mkdir(oldDir, { recursive: true });
  await mkdir(nextDir, { recursive: true });
  await mkdir(config.site);
  await mkdir(join(config.root, "private"));
  await writeFile(join(oldDir, "manifest.json"), JSON.stringify(old));
  await writeFile(join(oldDir, ".successful"), "verified-old");
  await writeFile(join(nextDir, "manifest.json"), JSON.stringify(next));
  for (const name of [
    "migrations",
    "access-log-migrations",
    "profile-migrations",
    "visitor-migrations",
    "visitor-context-migrations",
    "relay",
    "geoip",
    "dist/profile",
  ])
    await cp(join("backend", name), join(nextDir, "backend", name), { recursive: true });
  await cp("backend/analytics-catalogue.json", join(nextDir, "backend/analytics-catalogue.json"));
  const pm = require("../ops/profile-metadata.cjs");
  await writeFile(
    join(nextDir, "backend/profile-runtime.json"),
    JSON.stringify(await pm.createProfileRuntimeMetadata(join(nextDir, "backend"))),
  );
  await symlink(
    oldDir,
    join(config.root, "current"),
    process.platform === "win32" ? "junction" : "dir",
  );
  await writeFile(join(config.site, ".htaccess"), "parent-original");
  const secret = Buffer.alloc(32, 4).toString("base64url");
  const env = `PROFILE_ASSET_DIR='${join(config.root, "private/profile-assets")}'\nANALYTICS_RELAY_SECRET=${secret}\nGEOIP_COUNTRY_FILE='${join(config.root, "current/backend/geoip/country.mmdb")}'\nAUTH_ALLOWED_ORIGINS=https://bibistudio.vn\nCLIENT_IP_SOURCE_VERIFIED=false\n`;
  for (const name of ["runtime.env", "maintenance.env"])
    await writeFile(join(config.root, "private", name), env, { mode: 0o600 });
  await writeFile(
    join(config.root, "private/analytics-relay.json"),
    JSON.stringify({
      environment: "production",
      secret,
      origins: ["https://bibistudio.vn"],
      targetUrl: "https://bibistudio.vn/api/analytics/collect",
    }),
    { mode: 0o600 },
  );
  const receipt = {
    verified: true,
    profiles: true,
    assetCount: 0,
    manifestSha256: "f".repeat(64),
    sha256: "e".repeat(64),
    bytes: 10,
  };
  const calls = [];
  const status = (meta) => ({
    state: "complete",
    version: 1,
    migrationChecksums: meta.migrationChecksums,
  });
  await assert.rejects(
    deploy.activateRelease(config, next.releaseId, {
      install: async () => {},
      profileRun: async (_c, _d, cmd) => (cmd === "profile-status" ? status(prior[2]) : receipt),
      visitorRun: async () => status(prior[3]),
      retireVisitorCrons: async () => ({ verified: true }),
      prepareDatabase: async () => {
        calls.push("database");
        return receipt;
      },
      contextRun: async (_c, _d, cmd) => {
        calls.push(cmd);
        if (cmd === "context-migrate") throw new Error("isolated context migration failure");
        return { state: "empty", version: 0, migrationChecksums: {} };
      },
    }),
    /context migration failure/,
  );
  assert.deepEqual(calls, ["database", "context-status", "context-migrate"]);
  assert.equal(await readlink(join(config.root, "current")), oldDir);
  assert.equal(await readFile(join(config.site, ".htaccess"), "utf8"), "parent-original");
  await assert.rejects(stat(join(config.site, "api/analytics/relay/collect.php")), {
    code: "ENOENT",
  });
});
