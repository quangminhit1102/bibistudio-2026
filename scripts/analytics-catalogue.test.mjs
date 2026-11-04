import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildAnalyticsCatalogue } from "./analytics-catalogue.mjs";

const source = `throw new Error('must not execute source');
const productTypes=[{slug:'notebooks',name:{vi:'Sổ tay'}}];
const collections=[{slug:'explore-vietnam',name:{vi:'Khám phá Việt Nam'}}];
const products=[p('test-notebook','Sổ kiểm thử','Test','notebook','explore-vietnam','', '', [])];`;
test("manifest extracts only public route/product labels without executing imports or source", () => {
  const result = buildAnalyticsCatalogue(
    source,
    `const blogPosts=[{slug:'test-article',title:'Bài viết'}];`,
  );
  assert.deepEqual(result.products, [{ slug: "test-notebook", name: "Sổ kiểm thử" }]);
  assert.ok(result.routes.some((route) => route.path === "/products/notebooks"));
  assert.ok(result.routes.some((route) => route.path === "/blog/test-article"));
  assert.ok(!result.products.some((product) => product.slug === "notebooks"));
  assert.ok(!JSON.stringify(result).includes("must not execute"));
  assert.ok(!result.routes.some((route) => route.path.startsWith("/admin")));
});
test("unknown source shapes, duplicate products and type/detail slug collisions fail closed", () => {
  for (const broken of [
    source.replace("'test-notebook'", "process.env.PRIVATE_VALUE"),
    source.replace("'test-notebook'", "'notebooks'"),
    source.replace("const products=[", "const products=[p('test-notebook','duplicate'),"),
  ])
    assert.throws(() => buildAnalyticsCatalogue(broken, "const blogPosts=[];"));
});
test("current public catalogue generates map notebooks and articles but no admin routes", async () => {
  const [catalogue, blog] = await Promise.all([
    readFile(new URL("../src/data/catalogue.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/data/blog.ts", import.meta.url), "utf8"),
  ]);
  const result = buildAnalyticsCatalogue(catalogue, blog);
  assert.ok(result.products.some((product) => product.slug === "da-lat-map-notebook"));
  assert.ok(result.routes.some((route) => route.path.startsWith("/blog/")));
  assert.equal(
    result.products.some((product) => product.slug === "notebooks"),
    false,
  );
});
