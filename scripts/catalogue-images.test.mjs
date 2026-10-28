import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { localizeCatalogue, validateCatalogue, validateImage } from "./catalogue-images.mjs";

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 2, 0xff, 0xd9]);
async function fixture(t, url = "/__l5e/assets-v1/id/example.jpeg", filename = "example.jpeg") {
  const root = await mkdtemp(join(tmpdir(), "bibi-images-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "src/assets/catalogue"), { recursive: true });
  await mkdir(join(root, "public/catalogue"), { recursive: true });
  const path = join(root, "src/assets/catalogue/example.jpeg.asset.json");
  const metadata = { url, original_filename: filename, asset_id: "id", size: jpeg.length };
  await writeFile(path, JSON.stringify(metadata));
  return { root, path, metadata };
}

test("validates JPEG bytes and rejects HTML even with image headers", () => {
  assert.doesNotThrow(() => validateImage(jpeg, "image/jpeg"));
  assert.throws(() => validateImage(Buffer.from("<!doctype html>"), "image/jpeg"), /image/i);
  assert.throws(() => validateImage(jpeg, "text/html"), /content.type/i);
});
test("offline validation rejects unresolved Lovable URLs", async (t) => {
  const { root } = await fixture(t);
  await assert.rejects(validateCatalogue(root), /Lovable/);
});
test("offline validation rejects missing files and fake images", async (t) => {
  const { root } = await fixture(t, "/catalogue/example.jpeg");
  await assert.rejects(validateCatalogue(root), /missing/i);
  await writeFile(join(root, "public/catalogue/example.jpeg"), "<html>fallback</html>");
  await assert.rejects(validateCatalogue(root), /image/i);
  await writeFile(join(root, "public/catalogue/example.jpeg"), jpeg);
  await validateCatalogue(root);
});
test("localization preserves provenance and validates offline without fetching", async (t) => {
  const { root, path, metadata } = await fixture(t);
  await localizeCatalogue(root, async (url) => {
    assert.equal(url, "https://bibistudio-2026.lovable.app/__l5e/assets-v1/id/example.jpeg");
    return new Response(jpeg, { headers: { "content-type": "image/jpeg" } });
  });
  assert.deepEqual(JSON.parse(await readFile(path, "utf8")), {
    ...metadata,
    url: "/catalogue/example.jpeg",
  });
  await validateCatalogue(root);
  await localizeCatalogue(root, () => {
    throw new Error("Unexpected network request");
  });
});
test("rejects unsafe filenames before requesting assets", async (t) => {
  const { root } = await fixture(t, undefined, "../outside.jpeg");
  await assert.rejects(
    localizeCatalogue(root, () => {
      throw new Error("Should not fetch");
    }),
    /filename/i,
  );
});
test("HTTP failure leaves descriptor unchanged", async (t) => {
  const { root, path, metadata } = await fixture(t);
  await assert.rejects(
    localizeCatalogue(root, async () => new Response("missing", { status: 404 })),
    /404/,
  );
  assert.deepEqual(JSON.parse(await readFile(path, "utf8")), metadata);
});
test("a later invalid download leaves every descriptor unchanged", async (t) => {
  const { root, path, metadata } = await fixture(t);
  const second = { ...metadata, original_filename: "second.jpeg", asset_id: "second" };
  const secondPath = join(root, "src/assets/catalogue/second.jpeg.asset.json");
  await writeFile(secondPath, JSON.stringify(second));
  let calls = 0;
  await assert.rejects(
    localizeCatalogue(root, async () =>
      ++calls === 1
        ? new Response(jpeg, { headers: { "content-type": "image/jpeg" } })
        : new Response("<html>fallback</html>", { headers: { "content-type": "text/html" } }),
    ),
    /content.type/i,
  );
  assert.deepEqual(JSON.parse(await readFile(path, "utf8")), metadata);
  assert.deepEqual(JSON.parse(await readFile(secondPath, "utf8")), second);
});
