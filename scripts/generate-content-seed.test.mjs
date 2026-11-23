import test from "node:test";
import assert from "node:assert/strict";
import { access, cp, mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildContentSeed, writeContentSeed } from "./generate-content-seed.mjs";

// Generates the seed in a scratch copy, so the test never rewrites the committed files.
async function writeContentSeedTo(catalogue, blog) {
  const dir = await mkdtemp(join(tmpdir(), "content-seed-"));
  try {
    await mkdir(join(dir, "src/data"), { recursive: true });
    await mkdir(join(dir, "backend"), { recursive: true });
    await cp(
      new URL("../src/assets/catalogue", import.meta.url),
      join(dir, "src/assets/catalogue"),
      {
        recursive: true,
      },
    );
    await writeFile(join(dir, "src/data/catalogue.ts"), catalogue);
    await writeFile(join(dir, "src/data/blog.ts"), blog);
    return await writeContentSeed(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const blog = `const journalImage = (file) => "/base/journal/" + file;
const coverImage = journalImage("test.jpg");
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

const catalogue = `const productTypes=[
  {id:'notebook',slug:'notebooks',name:{vi:'Sổ tay',en:'Notebook'},plural:{vi:'Sổ tay',en:'Notebooks'},tagline:{vi:'Giấy nhỏ',en:'Small paper'},image:'/catalogue/n.webp'},
  {id:'envelope',slug:'envelopes',name:{vi:'Bao thư',en:'Envelope'},plural:{vi:'Bao thư',en:'Envelopes'},tagline:{vi:'Giữ lời nhắn',en:'Keeps a message'}}
];
const collections=[{slug:'motivation',name:{vi:'Động lực',en:'Motivation'},tagline:{vi:'Lời nhắc'},intro:{vi:'Giới thiệu'},image:assetUrl(main.url)}];
const products=[p('test-notebook','Sổ','Notebook','notebook','motivation','Mô tả','Desc',['/a.webp','/b.webp'],true,'womens-day-83')];`;

test("buildContentSeed converts ContentBlock[] to HTML and maps categories/products without executing source", () => {
  const result = buildContentSeed(catalogue, blog);
  assert.equal(result.posts.length, 1);
  assert.equal(result.posts[0].categorySlug, "cam-hung");
  assert.equal(result.posts[0].status, "published");
  assert.equal(result.posts[0].publishAt, "2026-08-25");
  assert.equal(result.posts[0].readTime, "5 phút đọc");
  assert.equal(result.posts[0].imageId, "/journal/test.jpg");
  assert.equal(result.posts[0].coverImageId, null);
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
  assert.deepEqual(result.products[0].imageIds, ["/a.webp", "/b.webp"]);
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
    {
      slug: "motivation",
      name: "Động lực",
      description: "Giới thiệu",
      position: 0,
      translations: {
        vi: { name: "Động lực", tagline: "Lời nhắc", intro: "Giới thiệu" },
        en: { name: "Motivation" },
      },
      // Not a string literal: the public page keeps its bundled image.
      image: null,
    },
  ]);
  assert.deepEqual(result.productTypes, [
    {
      code: "notebook",
      slug: "notebooks",
      name: "Sổ tay",
      description: "Giấy nhỏ",
      position: 0,
      translations: {
        vi: { name: "Sổ tay", plural: "Sổ tay", tagline: "Giấy nhỏ" },
        en: { name: "Notebook", plural: "Notebooks", tagline: "Small paper" },
      },
      image: "/catalogue/n.webp",
    },
    {
      code: "envelope",
      slug: "envelopes",
      name: "Bao thư",
      description: "Giữ lời nhắn",
      position: 1,
      translations: {
        vi: { name: "Bao thư", plural: "Bao thư", tagline: "Giữ lời nhắn" },
        en: { name: "Envelope", plural: "Envelopes", tagline: "Keeps a message" },
      },
      image: null,
    },
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
  const result = JSON.parse(
    await readFile(new URL("../backend/content-seed.json", import.meta.url), "utf8"),
  );
  assert.deepEqual(result, await writeContentSeedTo(catalogueSource, blogSource));
  assert.equal(result.posts.length, 10);
  assert.ok(result.posts.every((post) => post.content.startsWith("<")));
  assert.ok(result.products.some((product) => product.slug === "bun-bo-hue-notebook"));
  assert.ok(result.products.some((product) => product.slug === "ao-dai-saigon-card"));
  assert.equal(result.productCategories.length, 7);
  assert.deepEqual(
    result.productTypes.map((type) => [type.code, type.slug]),
    [
      ["notebook", "notebooks"],
      ["greeting-card", "greeting-cards"],
      ["postcard", "postcards"],
      ["envelope", "envelopes"],
      ["letter-paper", "letter-paper"],
      ["magnet", "magnets"],
    ],
  );
  // Every product points at a seeded type and collection, so backend validation accepts it.
  const typeCodes = new Set(result.productTypes.map((type) => type.code));
  const collectionSlugs = new Set(result.productCategories.map((c) => c.slug));
  assert.ok(result.products.every((product) => typeCodes.has(product.productType)));
  assert.ok(result.products.every((product) => collectionSlugs.has(product.collection)));
  assert.equal(result.contentCategories.length, 3);
  const codes = new Set(result.products.map((product) => product.productCode));
  assert.equal(codes.size, result.products.length);
  assert.ok(
    result.posts.every((post) => typeof post.readTime === "string" && post.readTime.length > 0),
  );
  assert.ok(
    result.posts.every(
      (post) => post.imageId.startsWith("/journal/") && post.coverImageId === null,
    ),
  );
  // Every image is a public file of the repository, so a fresh database shows all of them.
  const files = [
    ...result.posts.map((post) => post.imageId),
    ...result.products.flatMap((product) => product.imageIds),
  ];
  assert.equal(files.length, 87);
  for (const file of files) await access(new URL("../public" + file, import.meta.url));
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

test("a product image read from an imported asset file becomes that file's public path", () => {
  const source = catalogue
    .replace(
      "const productTypes",
      'import main from "@/assets/catalogue/main.jpg.asset.json";\nconst productTypes',
    )
    .replace("['/a.webp','/b.webp']", "[assetUrl(main.url), '/b.webp']");
  const result = buildContentSeed(source, blog, {
    "@/assets/catalogue/main.jpg.asset.json": "/catalogue/main.jpg",
  });
  assert.deepEqual(result.products[0].imageIds, ["/catalogue/main.jpg", "/b.webp"]);
  assert.throws(() => buildContentSeed(source, blog), /Unsupported product image source/);
});
