import test from "node:test";
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { verifyCountryArchive, downloadCountryArchive } from "./prepare-geoip.mjs";
const bytes = Buffer.from("fixture MMDB bytes");
const gz = gzipSync(bytes);
const hash = (b, a = "sha256") => createHash(a).update(b).digest("hex");
const lock = {
  archiveSha256: hash(gz),
  mmdbSha256: hash(bytes),
  vendorSha1: hash(bytes, "sha1"),
  vendorDigestTarget: "mmdb",
};
test("verifies both hashes and explicit vendor digest target", () => {
  assert.deepEqual(verifyCountryArchive(gz, lock), bytes);
  for (const key of ["archiveSha256", "mmdbSha256", "vendorSha1"])
    assert.throws(
      () => verifyCountryArchive(gz, { ...lock, [key]: "0".repeat(lock[key].length) }),
      /checksum/i,
    );
  assert.throws(
    () => verifyCountryArchive(gz, { ...lock, vendorDigestTarget: "ambiguous" }),
    /target/i,
  );
  assert.throws(() => verifyCountryArchive(Buffer.from("broken"), lock));
});
test("rejects compressed and expanded size limits", () => {
  assert.throws(() => verifyCountryArchive(gz, lock, { compressedLimit: gz.length - 1 }), /size/i);
  assert.throws(
    () => verifyCountryArchive(gz, lock, { expandedLimit: bytes.length - 1 }),
    /size|larger/i,
  );
});
test("download enforces status, time and streamed byte cap without redirects", async () => {
  let observed;
  const fetcher = async (url, options) => {
    observed = options;
    return new Response(gz);
  };
  assert.deepEqual(
    await downloadCountryArchive("https://example.test/data", { fetcher, limit: gz.length }),
    gz,
  );
  assert.equal(observed.redirect, "error");
  assert.ok(observed.signal);
  await assert.rejects(
    downloadCountryArchive("https://example.test/data", { fetcher, limit: gz.length - 1 }),
    /size/i,
  );
  await assert.rejects(
    downloadCountryArchive("https://example.test/data", {
      fetcher: async () => new Response("", { status: 404 }),
    }),
    /404/,
  );
});
