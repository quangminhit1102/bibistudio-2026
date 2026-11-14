import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { readFile, writeFile, mkdir, realpath, stat, rename, symlink } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const digest = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const hostRoot = "/home/vhplasti/bibi-deploy/production";

export function verifyContentHostReceipt(receipt) {
  const require = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  require(receipt?.version === 1 &&
    receipt.readerVersion === 1 &&
    Number.isFinite(Date.parse(receipt.measuredAt)), "Unsupported or undated content proof");
  require(receipt.headMeasured === true &&
    receipt.headStatus === 200 &&
    receipt.headBytes === 0, "HEAD proof is missing or invalid");
  require(receipt.htmlStatus === 200 &&
    digest(receipt.htmlSha256) &&
    receipt.htmlSha256 === receipt.expectedHtmlSha256, "Initial HTML proof mismatch");
  require(receipt.contentType?.toLowerCase() === "text/html; charset=utf-8" &&
    receipt.cacheControl === "no-store", "HTML response headers mismatch");
  require(receipt.redirectStatus === 301 &&
    receipt.redirectLocationMatched === true, "301 redirect proof missing");
  require(receipt.notFoundStatus === 404 &&
    receipt.notFoundMarkerMatched === true, "PHP 404 proof missing");
  require(receipt.privateMapDenied === true &&
    receipt.pathEscapeDenied === true, "Private path containment proof missing");
  require(JSON.stringify(receipt.pointerBodies) ===
    JSON.stringify([
      "cms-canary-a",
      "cms-canary-b",
      "cms-canary-a",
    ]), "Atomic pointer/cache refresh proof missing");
  require(Array.isArray(receipt.reservedRoutes) &&
    receipt.reservedRoutes.length === 3 &&
    ["root", "api", "node-test"].every((name) => {
      const rows = receipt.reservedRoutes.filter((row) => row.name === name);
      return (
        rows.length === 1 &&
        digest(rows[0].before) &&
        rows[0].before === rows[0].after &&
        Number.isInteger(rows[0].statusBefore) &&
        rows[0].statusBefore >= 200 &&
        rows[0].statusBefore < 500 &&
        rows[0].statusBefore === rows[0].statusAfter
      );
    }), "Changed or unmeasured reserved routing");
  require(receipt.cleanupVerified === true, "Owned temporary routing cleanup not verified");
  require(/^8\./.test(receipt.php) &&
    /^2\.(?:2[8-9]|[3-9]\d)$/.test(receipt.libc), "PHP/libc prerequisite not proven");
  for (const [name, platform] of [
    ["localCodec", "win32"],
    ["hostCodec", "linux"],
  ]) {
    const proof = receipt[name];
    require(proof?.platform === platform &&
      /^v24\./.test(proof.node) &&
      /^0\.35\./.test(proof.sharp) &&
      /^3\./.test(proof.dompurify) &&
      /^30\./.test(proof.jsdom), `${name} codec versions not proven`);
    require(["commonjs", "jpeg", "png", "webp", "metadataStripped", "maliciousMarkupRemoved"].every(
      (key) => proof[key] === true,
    ), `${name} codec/CommonJS sanitizer proof missing`);
    require(digest(proof.cjsSha256), `${name} codec compiled checksum missing`);
  }
  require(receipt.localCodec.cjsSha256 ===
    receipt.hostCodec.cjsSha256, "Different compiled codec proofs");
  const quota = receipt.accountQuota;
  require(quota?.source === "cpanel-account" &&
    Number.isSafeInteger(quota.limitBytes) &&
    Number.isSafeInteger(quota.usedBytes) &&
    quota.limitBytes > 0 &&
    quota.usedBytes >= 0, "Measured account quota missing");
  require(Number.isSafeInteger(quota.requiredAdditionalBytes) &&
    quota.requiredAdditionalBytes >= 4294967296 &&
    quota.limitBytes - quota.usedBytes >=
      quota.requiredAdditionalBytes, "Insufficient account headroom");
  return { ok: true, readerVersion: 1 };
}

const html = (marker) =>
  `<!doctype html><html lang="vi"><head><title>CMS feasibility canary</title></head><body><main>${marker}</main></body></html>`;

// Host-only, disposable canaries. No live CMS route, config, key or DB is changed.
export async function measureHost(bootstrap) {
  assert.equal(process.platform, "linux");
  assert.match(process.version, /^v24\./);
  assert.match(
    bootstrap,
    /^\/home\/vhplasti\/bibi-deploy\/production\/private\/content-spike-bootstrap-[a-f0-9]{16}$/,
  );
  assert.equal(await realpath(bootstrap), bootstrap);
  assert.equal((await stat(bootstrap)).uid, process.getuid());
  const config = JSON.parse(await readFile(`${hostRoot}/config.json`, "utf8"));
  assert.equal(config.maxManagedBytes, 4294967296);
  const site = await realpath(config.site);
  assert.equal(site, "/home/vhplasti/bibistudio.vn");
  const quota = JSON.parse(await readFile(`${bootstrap}/quota.json`, "utf8"));
  const localCodec = JSON.parse(await readFile(`${bootstrap}/local.json`, "utf8"));
  const execute = (command, args, cwd = bootstrap) => {
    const result = spawnSync(command, args, { cwd, encoding: "utf8", timeout: 180000 });
    if (result.status !== 0)
      throw Error(
        (result.stderr || result.stdout || result.error?.message || "Probe process failed").slice(
          -3000,
        ),
      );
    return result.stdout;
  };
  await writeFile(
    `${bootstrap}/package.json`,
    JSON.stringify({
      private: true,
      dependencies: { sharp: "0.35.5", dompurify: "3.4.17", jsdom: "30.1.3" },
    }),
    { mode: 0o600 },
  );
  execute(config.npmBin, [
    "install",
    "--no-audit",
    "--no-fund",
    "--registry=https://registry.npmjs.org",
  ]);
  const hostCodec = JSON.parse(execute(process.execPath, [`${bootstrap}/probe.cjs`]));
  assert.equal(hostCodec.cjsSha256, localCodec.cjsSha256);
  const id = randomBytes(8).toString("hex"),
    prefix = `/.well-known/bibi-cms-probe-${id}`;
  const privateRoot = `${bootstrap}/fixture-${id}`,
    publicRoot = site + prefix;
  await mkdir(privateRoot, { mode: 0o700 });
  for (const name of ["a", "b"]) {
    await mkdir(`${privateRoot}/${name}`, { mode: 0o700 });
    await writeFile(`${privateRoot}/${name}/index.html`, html(`cms-canary-${name}`), {
      mode: 0o600,
    });
    await writeFile(`${privateRoot}/${name}/map.json`, JSON.stringify({ privateCanary: true }), {
      mode: 0o600,
    });
  }
  const activate = async (name) => {
    const temporary = `${privateRoot}/next-${randomBytes(4).toString("hex")}`;
    await symlink(`${privateRoot}/${name}`, temporary);
    await rename(temporary, `${privateRoot}/active`);
  };
  await activate("a");
  const response = async (relative, method = "GET") => {
    const r = await fetch(`https://bibistudio.vn${relative}`, {
      method,
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
      headers: { "user-agent": "Bibi-CMS-feasibility/1" },
    });
    const body = await r.text();
    if (body.length > 500000) throw Error("Oversized canary response");
    return {
      status: r.status,
      body,
      type: r.headers.get("content-type"),
      cache: r.headers.get("cache-control"),
      location: r.headers.get("location"),
    };
  };
  const reserved = [
    { name: "root", file: `${site}/.htaccess`, url: "/" },
    { name: "api", file: `${site}/api/.htaccess`, url: "/api/health" },
    { name: "node-test", file: `${site}/node-test/.htaccess`, url: "/node-test/" },
  ];
  const hashFile = async (filename) => {
    try {
      return sha256(await readFile(filename));
    } catch (error) {
      if (error.code === "ENOENT") return sha256("absent");
      throw error;
    }
  };
  const reservedRoutes = [];
  for (const item of reserved)
    reservedRoutes.push({
      name: item.name,
      before: await hashFile(item.file),
      statusBefore: (await response(item.url)).status,
    });
  const expiry = Math.floor(Date.now() / 1000) + 900;
  const php = `<?php\ndeclare(strict_types=1);\nheader('Cache-Control: no-store');header('Content-Type: text/html; charset=utf-8');\nif(time()>${expiry}){http_response_code(404);exit('cms-expired');}\n$p=rawurldecode(substr(parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH),${prefix.length}));\nif(str_contains($p,'..')||str_contains($p,'\\\\')){http_response_code(404);exit('cms-path-denied');}\nif($p==='/map.json'){http_response_code(404);exit('cms-map-denied');}\nif($p==='/old'){header('Location: ${prefix}/',true,301);exit;}\nif($p!=='/'){http_response_code(404);exit('cms-missing');}\nclearstatcache(true);$r=realpath('${privateRoot}/active');\nif(!in_array($r,['${privateRoot}/a','${privateRoot}/b'],true)){http_response_code(503);exit;}\nif($_SERVER['REQUEST_METHOD']!=='HEAD'){readfile($r.'/index.html');}\n`;
  let receipt,
    failure,
    created = false;
  try {
    await mkdir(publicRoot, { mode: 0o755 });
    created = true;
    await writeFile(
      `${publicRoot}/.htaccess`,
      "Options -Indexes\nPassengerEnabled off\nRewriteEngine On\nRewriteRule ^index\\.php$ - [L]\nRewriteRule ^ index.php [END]\n",
      { mode: 0o644 },
    );
    await writeFile(`${publicRoot}/index.php`, php, { mode: 0o644 });
    const first = await response(prefix + "/"),
      head = await response(prefix + "/", "HEAD"),
      redirect = await response(prefix + "/old"),
      missing = await response(prefix + "/not-found"),
      map = await response(prefix + "/map.json"),
      escape = await response(prefix + "/escape%2f..%2fx");
    const pointerBodies = [];
    for (const name of ["a", "b", "a"]) {
      await activate(name);
      const r = await response(prefix + "/");
      pointerBodies.push(
        r.status === 200 && r.body === html(`cms-canary-${name}`)
          ? `cms-canary-${name}`
          : "mismatch",
      );
    }
    receipt = {
      version: 1,
      readerVersion: 1,
      measuredAt: new Date().toISOString(),
      headMeasured: true,
      headStatus: head.status,
      headBytes: Buffer.byteLength(head.body),
      htmlStatus: first.status,
      htmlSha256: sha256(first.body),
      expectedHtmlSha256: sha256(html("cms-canary-a")),
      contentType: first.type,
      cacheControl: first.cache,
      redirectStatus: redirect.status,
      redirectLocationMatched: redirect.location === prefix + "/",
      notFoundStatus: missing.status,
      notFoundMarkerMatched: missing.body === "cms-missing",
      privateMapDenied: map.status === 404 && map.body === "cms-map-denied",
      pathEscapeDenied: escape.status === 404 && escape.body === "cms-path-denied",
      pointerBodies,
      reservedRoutes,
      cleanupVerified: false,
      php: execute("php", ["-r", "echo PHP_VERSION;"]),
      libc: process.report.getReport().header.glibcVersionRuntime,
      localCodec,
      hostCodec,
      accountQuota: quota,
    };
  } catch (error) {
    failure = error;
  } finally {
    // Recoverable cleanup: move only the freshly created owned directory outside docroot.
    if (created) await rename(publicRoot, `${privateRoot}/retired-public-probe`);
    for (let n = 0; n < reserved.length; n++) {
      reservedRoutes[n].after = await hashFile(reserved[n].file);
      reservedRoutes[n].statusAfter = (await response(reserved[n].url)).status;
    }
    if (receipt)
      receipt.cleanupVerified = reservedRoutes.every(
        (item) => item.before === item.after && item.statusBefore === item.statusAfter,
      );
  }
  if (failure) throw failure;
  await writeFile(`${bootstrap}/host-receipt.json`, JSON.stringify(receipt, null, 2), {
    mode: 0o600,
  });
  console.log(JSON.stringify(receipt));
  return verifyContentHostReceipt(receipt);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [action, filename] = process.argv.slice(2);
  const main = async () => {
    if (action === "--verify")
      console.log(
        JSON.stringify(verifyContentHostReceipt(JSON.parse(await readFile(filename, "utf8")))),
      );
    else if (action === "--measure-host") await measureHost(filename);
    else throw Error("Use --verify RECEIPT or the Linux-only --measure-host BOOTSTRAP");
  };
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
