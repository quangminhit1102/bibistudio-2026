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
  posts: [{ slug: "first-post", imageId: "/journal/first.jpg", coverImageId: null }],
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
      `UPDATE products SET image_ids = '["/catalogue/a.webp","/catalogue/a-detail.webp"]', revision = revision + 1 WHERE slug = 'a-notebook' AND JSON_LENGTH(image_ids) = 2 AND JSON_UNQUOTE(JSON_EXTRACT(image_ids, '$[0]')) = 'catalogue-image-a-notebook-0' AND JSON_UNQUOTE(JSON_EXTRACT(image_ids, '$[1]')) = 'catalogue-image-a-notebook-1';`,
    ),
  );
  assert.ok(
    apply.includes(
      `UPDATE posts SET image_id = '/journal/first.jpg', cover_image_id = NULL, revision = revision + 1 WHERE slug = 'first-post' AND COALESCE(cover_image_id, image_id) = 'journal-cover-first-post' AND image_id IN ('journal-cover-first-post', 'journal-cover-first-post');`,
    ),
  );
  assert.ok(
    apply.indexOf("INSERT INTO content_image_refs_backup") < apply.indexOf("UPDATE products"),
  );
  assert.match(apply, /START TRANSACTION;[\s\S]*COMMIT;/);

  const rollback = rollbackSql(plan);
  assert.ok(
    rollback.includes(
      `UPDATE products SET image_ids = '["catalogue-image-a-notebook-0","catalogue-image-a-notebook-1"]', revision = revision + 1 WHERE slug = 'a-notebook' AND JSON_LENGTH(image_ids) = 2 AND JSON_UNQUOTE(JSON_EXTRACT(image_ids, '$[0]')) = '/catalogue/a.webp' AND JSON_UNQUOTE(JSON_EXTRACT(image_ids, '$[1]')) = '/catalogue/a-detail.webp';`,
    ),
  );
  assert.match(rollback, /UPDATE posts p JOIN content_image_refs_backup b/);
  assert.ok(
    rollback.includes(
      `SET p.image_id = b.old_value, p.cover_image_id = b.old_cover, p.revision = p.revision + 1 WHERE p.slug = 'first-post' AND p.image_id = '/journal/first.jpg' AND p.cover_image_id IS NULL;`,
    ),
  );

  const preview = previewSql(plan);
  assert.doesNotMatch(preview, /\b(UPDATE|INSERT|DELETE|CREATE|DROP|ALTER)\b/);
  assert.match(preview, /SELECT/);
  // A post apply would leave alone is told apart: the cover an editor picked or removed is shown.
  assert.ok(
    preview.includes(
      "IF(cover_image_id IS NULL, NULL, IF(image_id IS NULL, '(removed)', IF(image_id NOT IN (CONCAT('journal-cover-', slug), cover_image_id), image_id, NULL)))",
    ),
  );
  // Every change raises the row's revision, so an editor opened before it cannot save over it.
  for (const sql of [apply, rollback])
    for (const line of sql.split("\n").filter((line) => line.startsWith("UPDATE")))
      assert.match(line, /revision = (p\.)?revision \+ 1/);
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
  ]);
  // A seeded post without a cover is one an editor removed it from: listed, not a failure.
  assert.deepEqual(result.coverless, [{ kind: "post", slug: "first-post" }]);
  assert.equal(result.checked, 2);
});

test("a cover stored by the earlier seed as the build's own path is planned too", () => {
  const plan = planImageRefs(seed, {
    ...api,
    posts: [{ slug: "first-post", cover_url: "/assets/blog/first.jpg" }],
  });
  assert.deepEqual(plan.posts, [
    { slug: "first-post", from: "/assets/blog/first.jpg", to: "/journal/first.jpg" },
  ]);
  assert.deepEqual(plan.skipped, []);
  // The API shows the earlier seed's path even after an editor picked or removed a cover, so
  // the SQL also asks that image_id is still a seeded value; an empty image_id is not one.
  assert.ok(
    applySql(plan).includes(
      `AND COALESCE(cover_image_id, image_id) = '/assets/blog/first.jpg' AND image_id IN ('journal-cover-first-post', '/assets/blog/first.jpg');`,
    ),
  );
});

test("a post whose cover an editor removed loses the earlier seed's path too, and gets it back on undo", () => {
  const plan = planImageRefs(seed, {
    ...api,
    posts: [{ slug: "first-post", cover_url: "/assets/blog/first.jpg" }],
  });
  // The earlier seed's path is still in cover_image_id, which the API prefers: left there, the
  // post would name a file the release no longer has.
  assert.ok(
    applySql(plan).includes(
      `UPDATE posts SET cover_image_id = NULL, revision = revision + 1 WHERE slug = 'first-post' AND image_id IS NULL AND cover_image_id = '/assets/blog/first.jpg';`,
    ),
  );
  assert.ok(
    rollbackSql(plan).includes(
      `SET p.cover_image_id = b.old_cover, p.revision = p.revision + 1 WHERE p.slug = 'first-post' AND p.image_id IS NULL AND p.cover_image_id IS NULL AND b.old_value IS NULL AND b.old_cover = '/assets/blog/first.jpg';`,
    ),
  );
});

test("a cover path longer than image_id holds is a problem, not a change", () => {
  const to = `/journal/${"a".repeat(60)}.jpg`;
  const plan = planImageRefs({ products: [], posts: [{ slug: "first-post", imageId: to }] }, api);
  assert.deepEqual(plan.posts, []);
  assert.equal(plan.problems.length, 1);
});

test("checkContent asks for an image only where the seed had one, and only on the site itself", async () => {
  const asked = [];
  const fetchImage = async (url) => {
    asked.push(url);
    return { status: 200, headers: new Map([["content-type", "image/webp"]]) };
  };
  const result = await checkContent(
    seed,
    {
      products: [
        { slug: "a-notebook", images: [] },
        { slug: "b-card", images: [] },
        { slug: "from-admin", images: ["https://elsewhere.test/x.webp"] },
      ],
      posts: [
        { slug: "first-post", cover_url: "/journal/first.jpg" },
        { slug: "post-from-admin", cover_url: null },
      ],
    },
    "https://example.test",
    fetchImage,
  );
  assert.deepEqual(result.broken, [
    { kind: "product", slug: "a-notebook", url: null, status: null },
  ]);
  assert.deepEqual(result.external, [
    { kind: "product", slug: "from-admin", url: "https://elsewhere.test/x.webp" },
  ]);
  assert.deepEqual(result.coverless, []);
  assert.deepEqual(asked, ["https://example.test/journal/first.jpg"]);
});
