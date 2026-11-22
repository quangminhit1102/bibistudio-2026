import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildContentSeed } from "./generate-content-seed.mjs";

const blog = `import coverImage from "@/assets/blog/test.jpg";
throw new Error('must not execute source');
const blogPosts=[{
  slug:'test-post',
  title:'Tiêu đề',
  excerpt:'Tóm tắt',
  category:'Cảm hứng',
  author:'BiBi Studio',
  date:'2026-08-25',
  readTime:'5 phút đọc',
  coverImage:coverImage,
  content:[
    {type:'paragraph', text:'Xin <chào>'},
    {type:'heading', text:'Phần 1', level:2},
    {type:'quote', text:'Trích dẫn'},
    {type:'image', src:'/x.jpg', alt:'ảnh', caption:'Chú thích'}
  ],
  relatedHandles:[]
}];`;

const catalogue = `const collections=[{slug:'motivation',name:{vi:'Động lực'},intro:{vi:'Giới thiệu'}}];
const products=[p('test-notebook','Sổ','Notebook','notebook','motivation','Mô tả','Desc',['/a.webp','/b.webp'],true,'womens-day-83')];`;

test("buildContentSeed converts ContentBlock[] to HTML and maps categories/products without executing source", () => {
  const result = buildContentSeed(catalogue, blog);
  assert.equal(result.posts.length, 1);
  assert.equal(result.posts[0].categorySlug, "cam-hung");
  assert.equal(result.posts[0].status, "published");
  assert.equal(result.posts[0].publishAt, "2026-08-25");
  assert.equal(result.posts[0].readTime, "5 phút đọc");
  assert.equal(result.posts[0].coverImageId, "/assets/blog/test.jpg");
  assert.ok(result.posts[0].content.includes("<p>Xin &lt;chào&gt;</p>"));
  assert.ok(result.posts[0].content.includes("<h2>Phần 1</h2>"));
  assert.ok(result.posts[0].content.includes("<blockquote>Trích dẫn</blockquote>"));
  assert.ok(
    result.posts[0].content.includes(
      '<figure><img data-media-id="journal-inline-test-post-3" alt="ảnh"><figcaption>Chú thích</figcaption></figure>',
    ),
  );
  assert.equal(result.products.length, 1);
  assert.equal(result.products[0].productCode, "0001");
  assert.equal(result.products[0].categorySlug, "motivation");
  assert.deepEqual(result.products[0].imageIds, [
    "catalogue-image-test-notebook-0",
    "catalogue-image-test-notebook-1",
  ]);
  assert.equal(result.products[0].nameEn, "Notebook");
  assert.equal(result.products[0].descriptionEn, "Desc");
  assert.equal(result.products[0].shortDescriptionEn, "Desc");
  assert.equal(result.products[0].featured, true);
  assert.equal(result.products[0].occasion, "womens-day-83");
  assert.equal(result.products[0].sortOrder, 1);
  assert.equal(result.products[0].imageAltVi, "Sổ — sản phẩm BiBi Studio");
  assert.equal(result.products[0].imageAltEn, "Notebook — a BiBi Studio paper good");
  assert.equal(result.products[0].dimensions, null);
  assert.equal(result.products[0].materialVi, null);
  assert.equal(result.products[0].materialEn, null);
  assert.deepEqual(result.productCategories, [
    { slug: "motivation", name: "Động lực", description: "Giới thiệu", position: 0 },
  ]);
  assert.deepEqual(result.contentCategories, [{ slug: "cam-hung", name: "Cảm hứng", position: 0 }]);
  assert.ok(!JSON.stringify(result).includes("must not execute"));
});

test("buildContentSeed rejects non-literal slugs and duplicate products", () => {
  for (const broken of [
    catalogue.replace("'test-notebook'", "process.env.PRIVATE_VALUE"),
    catalogue.replace(
      "const products=[",
      "const products=[p('test-notebook','A','A','notebook','motivation','','',[]),p('test-notebook','B','B','notebook','motivation','','',[]),",
    ),
  ])
    assert.throws(() => buildContentSeed(broken, blog));
});

test("current static content generates 10 posts and the full product catalogue", async () => {
  const [catalogueSource, blogSource] = await Promise.all([
    readFile(new URL("../src/data/catalogue.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/data/blog.ts", import.meta.url), "utf8"),
  ]);
  const result = buildContentSeed(catalogueSource, blogSource);
  assert.equal(result.posts.length, 10);
  assert.ok(result.posts.every((post) => post.content.startsWith("<")));
  assert.ok(result.products.some((product) => product.slug === "bun-bo-hue-notebook"));
  assert.ok(result.products.some((product) => product.slug === "ao-dai-saigon-card"));
  assert.equal(result.productCategories.length, 7);
  assert.equal(result.contentCategories.length, 3);
  const codes = new Set(result.products.map((product) => product.productCode));
  assert.equal(codes.size, result.products.length);
  assert.ok(
    result.posts.every((post) => typeof post.readTime === "string" && post.readTime.length > 0),
  );
  assert.ok(
    result.posts.every(
      (post) =>
        typeof post.coverImageId === "string" && post.coverImageId.startsWith("/assets/blog/"),
    ),
  );
  const bunBo = result.products.find((product) => product.slug === "bun-bo-hue-notebook");
  assert.equal(bunBo.nameEn, "Bun Bo Hue");
  assert.equal(bunBo.featured, true);
  assert.equal(bunBo.occasion, null);
  const floral = result.products.find(
    (product) => product.slug === "womens-day-floral-border-card",
  );
  assert.equal(floral.featured, true);
  assert.equal(floral.occasion, "womens-day-83");
  assert.equal(floral.materialEn, null);
  assert.ok(result.products.every((product) => product.sortOrder >= 1));
  assert.ok(result.products.every((product) => typeof product.imageAltVi === "string"));
});
