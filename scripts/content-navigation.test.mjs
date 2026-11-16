import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
async function pure(file) {
  const text = ts.transpileModule(await readFile(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext },
  }).outputText;
  return import("data:text/javascript;base64," + Buffer.from(text).toString("base64"));
}
test("Blog document paths are navigation boundaries, never an analytics prefix allowlist", async () => {
  const { isBlogDocumentPath } = await pure("src/lib/blog-navigation.ts");
  for (const path of [
    "/blog",
    "/blog/",
    "/blog/new-post?utm_source=test",
    "/blog/category/paper",
    "/blog/page/2",
  ])
    assert.equal(isBlogDocumentPath(path), true);
  for (const path of [
    "/blogs",
    "/admin/content/posts",
    "https://evil.test/blog",
    "//evil.test/blog",
  ])
    assert.equal(isBlogDocumentPath(path), false);
});
test("native Blog enhancement has its own entry and cannot mount the CSR application", async () => {
  const entry = await readFile("src/blog-client.ts", "utf8"),
    config = await readFile("vite.blog.config.ts", "utf8");
  assert.match(config, /src\/blog-client\.ts/);
  assert.doesNotMatch(entry, /createRoot|main\.tsx|admin|tinymce|react-dom/);
  for (const file of ["src/components/site-header.tsx", "src/components/site-footer.tsx"])
    assert.match(await readFile(file, "utf8"), /reloadDocument|href="\/blog"/);
});
