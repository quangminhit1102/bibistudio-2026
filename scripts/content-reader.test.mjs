import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { publicContentCanary } from "../backend/dist/content/publication/publisher.js";
import { readActiveContent } from "../backend/dist/content/publication/active-read.js";
import {
  startContentReaderFixture,
  createReaderGenerations,
} from "./test-helpers/content-reader.mjs";

test("a persistent PHP worker observes an external pointer change", async (t) => {
  const f = await createReaderGenerations(t),
    { baseUrl } = await startContentReaderFixture(t, {
      paths: f.paths,
      canonicalOrigin: "https://bibistudio.vn",
    });
  const page = () => fetch(baseUrl + "/blog/first");
  assert.match(await (await page()).text(), /generation-one-body/);
  await publicContentCanary(f.paths, baseUrl, await readActiveContent(f.paths));
  await f.activate(f.second, f.first);
  assert.match(await (await page()).text(), /generation-two-body/);
  await f.activate(f.first, f.second);
  assert.match(await (await page()).text(), /generation-one-body/);
  const head = await fetch(baseUrl + "/blog/first", { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  assert.ok(Number(head.headers.get("content-length")) > 0);
  assert.match(head.headers.get("cache-control"), /no-store/);
  assert.equal((await fetch(baseUrl + "/blog/unknown")).status, 404);
  assert.equal((await fetch(baseUrl + "/blog/first", { method: "POST" })).status, 405);
});
test("PHP canonicalizes pagination, trailing slash and www aliases into one hop", async (t) => {
  const f = await createReaderGenerations(t),
    { baseUrl } = await startContentReaderFixture(t, {
      paths: f.paths,
      canonicalOrigin: "https://bibistudio.vn",
    });
  for (const [path, target] of [
    ["/blog?page=2", "/blog/page/2"],
    ["/blog/?page=1", "/blog"],
    ["/blog/old/", "/blog/first"],
  ]) {
    const response = await fetch(baseUrl + path, {
      redirect: "manual",
      headers: { Host: "www.bibistudio.vn" },
    });
    assert.equal(response.status, 301, path);
    assert.equal(response.headers.get("location"), "https://bibistudio.vn" + target);
    assert.match(response.headers.get("cache-control"), /no-store/);
  }
  for (const query of ["page=0", "page=02", "page=-1", "page=2&page=3", "page[]=2", "page=bad"])
    assert.equal((await fetch(baseUrl + "/blog?" + query)).status, 400, query);
  assert.equal((await fetch(baseUrl + "/blog/page/999")).status, 404);
  assert.equal((await fetch(baseUrl + "/blog/first?utm_source=test")).status, 200);
  const xml = await fetch(baseUrl + "/sitemaps/blog.xml");
  assert.equal(xml.status, 200);
  assert.match(xml.headers.get("content-type"), /application\/xml/);
  assert.match(await xml.text(), /https:\/\/bibistudio.vn\/blog\/first/);
  const index = await fetch(baseUrl + "/sitemap.xml");
  assert.equal(index.status, 200);
  assert.match(await index.text(), /sitemaps\/site\.xml.*sitemaps\/blog\.xml/);
});
test("PHP exposes only committed media, retains old images, and rejects internal or corrupt files", async (t) => {
  const f = await createReaderGenerations(t),
    { baseUrl } = await startContentReaderFixture(t, {
      paths: f.paths,
      canonicalOrigin: "https://bibistudio.vn",
    });
  const image = await fetch(baseUrl + f.publicMedia);
  assert.equal(image.status, 200);
  assert.match(image.headers.get("content-type"), /image\/webp/);
  assert.match(image.headers.get("cache-control"), /immutable/);
  const etag = image.headers.get("etag");
  assert.ok(etag);
  assert.equal(
    (await fetch(baseUrl + f.publicMedia, { headers: { "If-None-Match": etag } })).status,
    304,
  );
  assert.equal((await fetch(baseUrl + f.privateMedia)).status, 404);
  await f.activate(f.empty, f.first);
  assert.equal((await fetch(baseUrl + "/blog/first")).status, 404);
  assert.equal((await fetch(baseUrl + f.publicMedia)).status, 200);
  for (const path of [
    "/blog/manifest.json",
    "/blog/public.json",
    "/_bibi-content/reader.php",
    "/blog/%252e%252e/private",
    "/media/content/%2fprivate",
    "/media/content/" + "a".repeat(64) + ".php",
  ])
    assert.equal((await fetch(baseUrl + path)).status, 404, path);
  const data = join(f.paths.generations, f.empty, "public.json"),
    bytes = await readFile(data);
  await writeFile(data, Buffer.concat([bytes, Buffer.from("corrupt")]));
  const corrupt = await fetch(baseUrl + "/blog/first");
  assert.equal(corrupt.status, 503);
  assert.doesNotMatch(await corrupt.text(), /generations|password|config|[A-Z]:\\/);
  await writeFile(data, bytes);
  const configFile = join(f.paths.root, "private/content-reader.json"),
    config = JSON.parse(await readFile(configFile, "utf8"));
  await writeFile(
    configFile,
    JSON.stringify({ ...config, contentRoot: "/not-a-real-private-store" }),
  );
  const invalid = await fetch(baseUrl + "/blog");
  assert.equal(invalid.status, 503);
  assert.doesNotMatch(await invalid.text(), /not-a-real|password|config/);
});
