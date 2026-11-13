import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { openCountryLookup, createCountryLookup } from "../dist/visitors/country-lookup.js";
const lock = JSON.parse(
  await readFile(new URL("../../scripts/geoip-country.lock.json", import.meta.url), "utf8"),
);
const options = {
  file: new URL("../geoip/country.mmdb", import.meta.url),
  sha256: lock.mmdbSha256,
  version: lock.version,
};
test("pinned MMDB resolves public IPv4, mapped IPv4 and IPv6", async () => {
  const lookup = await openCountryLookup(options);
  for (const ip of ["8.8.8.8", "::ffff:8.8.8.8"])
    assert.deepEqual(lookup.lookup(ip), {
      code: "US",
      name: "United States",
      dataset: lock.version,
    });
  // This pinned dataset maps this anycast IPv6 to CA; it is not physical-location proof.
  assert.deepEqual(lookup.lookup("2001:4860:4860::8888"), {
    code: "CA",
    name: "Canada",
    dataset: lock.version,
  });
  for (const ip of [
    "127.0.0.1",
    "10.0.0.1",
    "192.0.2.1",
    "::1",
    "fe80::1",
    "bad",
    "8.8.8.8, 1.1.1.1",
    "8.8.8.8%zone",
  ])
    assert.equal(lookup.lookup(ip), null);
  lookup.close();
  assert.equal(lookup.lookup("8.8.8.8"), null);
});
test("startup rejects missing, corrupt and mismatched data", async () => {
  const dir = await mkdtemp(join(tmpdir(), "bibi-country-"));
  try {
    await assert.rejects(openCountryLookup({ ...options, file: join(dir, "missing") }));
    const file = join(dir, "bad");
    const bytes = Buffer.from("not MMDB");
    await writeFile(file, bytes);
    await assert.rejects(
      openCountryLookup({ ...options, file, sha256: "0".repeat(64) }),
      /checksum/i,
    );
    await assert.rejects(
      openCountryLookup({
        ...options,
        file,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      }),
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("miss/error cache is bounded, canonical, isolated by dataset and closes", () => {
  let calls = 0;
  const reader = {
    get(ip) {
      calls++;
      if (ip === "8.8.8.8") return { country: { iso_code: "US", names: { en: "United States" } } };
      if (ip === "1.1.1.1") throw new Error("lookup failed");
      return null;
    },
  };
  const a = createCountryLookup(reader, "v1");
  a.lookup("8.8.8.8");
  a.lookup("::ffff:8.8.8.8");
  assert.equal(calls, 1);
  assert.equal(a.lookup("9.9.9.9"), null);
  a.lookup("9.9.9.9");
  assert.equal(calls, 2);
  assert.equal(a.lookup("1.1.1.1"), null);
  a.lookup("1.1.1.1");
  assert.equal(calls, 3);
  for (let i = 0; i < 1025; i++) a.lookup("11.0." + Math.floor(i / 256) + "." + (i % 256));
  const before = calls;
  a.lookup("8.8.8.8");
  assert.equal(calls, before + 1);
  const b = createCountryLookup(reader, "v2");
  assert.equal(b.lookup("8.8.8.8").dataset, "v2");
  a.close();
  assert.equal(a.lookup("8.8.8.8"), null);
  b.close();
});
