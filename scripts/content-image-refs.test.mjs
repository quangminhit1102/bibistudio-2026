import test from "node:test";
import assert from "node:assert/strict";
import {
  applySql,
  checkContent,
  planImageRefs,
  previewSql,
  rollbackSql,
} from "./content-image-refs.mjs";

const seed = {
  products: [
    { slug: "a-notebook", imageIds: ["/catalogue/a.webp", "/catalogue/a-detail.webp"] },
    { slug: "b-card", imageIds: [] },
  ],
  posts: [{ slug: "first-post", coverImageId: "/journal/first.jpg" }],
};
const api = {
  products: [
    {
      slug: "a-notebook",
      images: [
        "/api/media/catalogue-image-a-notebook-0",
        "/api/media/catalogue-image-a-notebook-1",
      ],
    },
    { slug: "b-card", images: [] },
  ],
  posts: [{ slug: "first-post", cover_url: "/api/media/journal-cover-first-post" }],
};

test("plans a seeded product and post to their public paths", () => {
  const plan = planImageRefs(seed, api);
  assert.deepEqual(plan.products, [
    {
      slug: "a-notebook",
      from: ["catalogue-image-a-notebook-0", "catalogue-image-a-notebook-1"],
      to: ["/catalogue/a.webp", "/catalogue/a-detail.webp"],
    },
  ]);
  assert.deepEqual(plan.posts, [
    { slug: "first-post", from: "journal-cover-first-post", to: "/journal/first.jpg" },
  ]);
  assert.deepEqual(plan.problems, []);
  assert.deepEqual(plan.skipped, []);
});

test("leaves alone what is already a public path or was changed in the admin", () => {
  const plan = planImageRefs(seed, {
    products: [
      { slug: "a-notebook", images: ["/catalogue/a.webp", "/catalogue/a-detail.webp"] },
      { slug: "b-card", images: ["/api/media/0b0f5c1e-1111-4222-8333-444455556666"] },
    ],
    posts: [{ slug: "first-post", cover_url: "/journal/first.jpg" }],
  });
  assert.deepEqual(plan.products, []);
  assert.deepEqual(plan.posts, []);
  assert.deepEqual(plan.problems, []);
  assert.deepEqual(plan.skipped, [
    { kind: "product", slug: "b-card", reason: "changed in the admin" },
  ]);
});

test("reports a seed entry the API lacks and an image count that differs", () => {
  const plan = planImageRefs(seed, {
    products: [{ slug: "a-notebook", images: ["/api/media/catalogue-image-a-notebook-0"] }],
    posts: [],
  });
  assert.deepEqual(plan.products, []);
  assert.deepEqual(plan.problems, [
    {
      kind: "product",
      slug: "a-notebook",
      reason: "1 seeded image in the database, 2 in the seed",
    },
    { kind: "product", slug: "b-card", reason: "missing from the API" },
    { kind: "post", slug: "first-post", reason: "missing from the API" },
  ]);
});

test("the SQL changes only rows that still hold the seeded value, and undoes only its own change", () => {
  const plan = planImageRefs(seed, api);
  const apply = applySql(plan);
  assert.match(apply, /CREATE TABLE IF NOT EXISTS content_image_refs_backup/);
  assert.ok(
    apply.includes(
      `UPDATE products SET image_ids = '["/catalogue/a.webp","/catalogue/a-detail.webp"]' WHERE slug = 'a-notebook' AND JSON_LENGTH(image_ids) = 2 AND JSON_UNQUOTE(JSON_EXTRACT(image_ids, '$[0]')) = 'catalogue-image-a-notebook-0' AND JSON_UNQUOTE(JSON_EXTRACT(image_ids, '$[1]')) = 'catalogue-image-a-notebook-1';`,
    ),
  );
  assert.ok(
    apply.includes(
      `UPDATE posts SET cover_image_id = '/journal/first.jpg' WHERE slug = 'first-post' AND COALESCE(cover_image_id, image_id) = 'journal-cover-first-post';`,
    ),
  );
  assert.ok(
    apply.indexOf("INSERT INTO content_image_refs_backup") < apply.indexOf("UPDATE products"),
  );
  assert.match(apply, /START TRANSACTION;[\s\S]*COMMIT;/);

  const rollback = rollbackSql(plan);
  assert.ok(
    rollback.includes(
      `UPDATE products SET image_ids = '["catalogue-image-a-notebook-0","catalogue-image-a-notebook-1"]' WHERE slug = 'a-notebook' AND JSON_LENGTH(image_ids) = 2 AND JSON_UNQUOTE(JSON_EXTRACT(image_ids, '$[0]')) = '/catalogue/a.webp' AND JSON_UNQUOTE(JSON_EXTRACT(image_ids, '$[1]')) = '/catalogue/a-detail.webp';`,
    ),
  );
  assert.match(rollback, /UPDATE posts p JOIN content_image_refs_backup b/);
  assert.ok(rollback.includes(`p.cover_image_id = '/journal/first.jpg'`));

  const preview = previewSql(plan);
  assert.doesNotMatch(preview, /\b(UPDATE|INSERT|DELETE|CREATE|DROP|ALTER)\b/);
  assert.match(preview, /SELECT/);
});

test("SQL values are escaped", () => {
  const sql = applySql({
    products: [{ slug: "it's", from: ["x'y"], to: ["/c/o'k.webp"] }],
    posts: [],
  });
  assert.ok(sql.includes(`slug = 'it''s'`));
  assert.ok(sql.includes(`'["/c/o''k.webp"]'`));
  assert.ok(sql.includes(`= 'x''y'`));
});

test("checkContent names every seed entry the API lacks and every image that does not load", async () => {
  const fetchImage = async (url) =>
    url.endsWith("/catalogue/a.webp")
      ? { status: 200, headers: new Map([["content-type", "image/webp"]]) }
      : { status: 400, headers: new Map([["content-type", "application/json"]]) };
  const result = await checkContent(
    seed,
    {
      products: [
        {
          slug: "a-notebook",
          images: ["/catalogue/a.webp", "/api/media/catalogue-image-a-notebook-1"],
        },
      ],
      posts: [{ slug: "first-post", cover_url: null }],
    },
    "https://example.test",
    fetchImage,
  );
  assert.deepEqual(result.missing, [{ kind: "product", slug: "b-card" }]);
  assert.deepEqual(result.broken, [
    {
      kind: "product",
      slug: "a-notebook",
      url: "/api/media/catalogue-image-a-notebook-1",
      status: 400,
    },
    { kind: "post", slug: "first-post", url: null, status: null },
  ]);
  assert.equal(result.checked, 2);
});
