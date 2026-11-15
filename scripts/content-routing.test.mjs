import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname, basename } from "node:path";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import {
  installContentRouting,
  uninstallContentRouting,
  contentRoutingBlock,
} from "../ops/content-routing.cjs";
const hash = (value) => createHash("sha256").update(value).digest("hex");
async function fixture(t) {
  const temporary = await realpath(tmpdir()),
    root = await realpath(await mkdtemp(join(temporary, "bibi-routing-")));
  t.after(() => {
    if (dirname(root) !== temporary || !basename(root).startsWith("bibi-routing-"))
      throw Error("Unexpected fixture path");
    return rm(root, { recursive: true, force: true });
  });
  const site = join(root, "site"),
    deploy = join(root, "deploy");
  await mkdir(site);
  await mkdir(join(deploy, "private"), { recursive: true, mode: 0o700 });
  const before = await readFile(
    new URL("../ops/frontend.htaccess.template", import.meta.url),
    "utf8",
  );
  await writeFile(join(site, ".htaccess"), before);
  await mkdir(join(deploy, "content"));
  await writeFile(
    join(deploy, "private/content-reader.json"),
    JSON.stringify({
      schemaVersion: 1,
      environment: "local",
      contentRoot: join(deploy, "content"),
      canonicalOrigin: "http://127.0.0.1:5173",
    }),
    { mode: 0o600 },
  );
  return { root: deploy, site, expectedRootSha256: hash(before), before };
}
test("scoped routing preserves every existing rule and is idempotent and restorable", async (t) => {
  const f = await fixture(t),
    receipt = await installContentRouting(f),
    first = await readFile(join(f.site, ".htaccess"), "utf8");
  assert.equal(first.replace(contentRoutingBlock(), ""), f.before);
  assert.ok(first.indexOf("BIBI CONTENT BEGIN") < first.indexOf("^(?:api|node-test"));
  for (const path of ["api", "node-test", "assets", ".well-known"]) assert.ok(first.includes(path));
  assert.match(
    await readFile(join(f.site, "_bibi-content/reader.php"), "utf8"),
    /BIBI_CONTENT_CONFIG_FILE/,
  );
  assert.ok(receipt.backup);
  await installContentRouting(f);
  assert.equal(await readFile(join(f.site, ".htaccess"), "utf8"), first);
  await uninstallContentRouting(f, receipt);
  assert.equal(await readFile(join(f.site, ".htaccess"), "utf8"), f.before);
});
test("unknown root routing or modified owned reader files cannot be overwritten", async (t) => {
  const f = await fixture(t);
  await writeFile(join(f.site, ".htaccess"), f.before + "# unreviewed\n");
  await assert.rejects(installContentRouting(f), /hash|modified|routing/i);
  await writeFile(join(f.site, ".htaccess"), f.before);
  const receipt = await installContentRouting(f);
  await writeFile(join(f.site, "_bibi-content/reader.php"), "changed");
  await assert.rejects(installContentRouting(f), /modified|owned|checksum/i);
  await assert.rejects(uninstallContentRouting(f, receipt), /modified|owned|checksum/i);
});

test("a routing write failure restores all owned files before returning failure", async (t) => {
  const f = await fixture(t),
    rename = fs.rename;
  let failed = false;
  fs.rename = async (source, target) => {
    if (!failed && target === join(f.root, "private/content-routing.json")) {
      failed = true;
      throw Object.assign(Error("simulated disk failure"), { code: "EIO" });
    }
    return rename(source, target);
  };
  try {
    await assert.rejects(installContentRouting(f));
  } finally {
    fs.rename = rename;
  }
  assert.equal(failed, true);
  assert.equal(await readFile(join(f.site, ".htaccess"), "utf8"), f.before);
  await assert.rejects(
    readFile(join(f.site, "_bibi-content/reader.php")),
    (e) => e.code === "ENOENT",
  );
  await assert.rejects(
    readFile(join(f.root, "public-reader/content-reader.php")),
    (e) => e.code === "ENOENT",
  );
});
