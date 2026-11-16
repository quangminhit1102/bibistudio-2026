import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createContentEditingFixture, validCategory, validDraft } from "./helpers/content.mjs";

test("depth four is rejected without changing the category tree", async (t) => {
  const f = await createContentEditingFixture(t),
    one = await f.editing.saveCategory(f.admin, null, validCategory({ slug: "one" }), null),
    two = await f.editing.saveCategory(
      f.admin,
      null,
      validCategory({ slug: "two", parentId: one.id }),
      null,
    ),
    three = await f.editing.saveCategory(
      f.admin,
      null,
      validCategory({ slug: "three", parentId: two.id }),
      null,
    );
  await assert.rejects(
    f.editing.saveCategory(
      f.admin,
      null,
      validCategory({ slug: "four", parentId: three.id }),
      null,
    ),
    (error) => error.code === "CATEGORY_DEPTH",
  );
  await assert.rejects(
    f.editing.saveCategory(
      f.admin,
      one.id,
      validCategory({ slug: one.slug, parentId: three.id }),
      one.revision,
    ),
    (error) => error.code === "CATEGORY_CYCLE",
  );
  await assert.rejects(
    f.editing.saveCategory(
      f.admin,
      one.id,
      validCategory({ slug: one.slug, parentId: one.id }),
      one.revision,
    ),
    (error) => error.code === "CATEGORY_CYCLE",
  );
  await assert.rejects(
    f.editing.saveCategory(
      f.admin,
      null,
      validCategory({ slug: "missing", parentId: randomUUID() }),
      null,
    ),
    (error) => error.status === 404,
  );
  assert.equal((await f.editing.listCategories(f.admin, { page: 1, pageSize: 100 })).total, 3);
});

test("reparenting measures the full subtree and rejects depth overflow transactionally", async (t) => {
  const f = await createContentEditingFixture(t),
    root = await f.editing.saveCategory(f.admin, null, validCategory({ slug: "root" }), null),
    child = await f.editing.saveCategory(
      f.admin,
      null,
      validCategory({ slug: "child", parentId: root.id }),
      null,
    ),
    a = await f.editing.saveCategory(f.admin, null, validCategory({ slug: "a" }), null),
    b = await f.editing.saveCategory(
      f.admin,
      null,
      validCategory({ slug: "b", parentId: a.id }),
      null,
    );
  await assert.rejects(
    f.editing.saveCategory(
      f.admin,
      root.id,
      validCategory({ slug: root.slug, parentId: b.id }),
      root.revision,
    ),
    (error) => error.code === "CATEGORY_DEPTH",
  );
  assert.equal((await f.editing.getCategory(f.admin, root.id)).parentId, null);
  assert.equal((await f.editing.getCategory(f.admin, child.id)).parentId, root.id);
  await assert.rejects(
    f.editing.removeUnusedCategory(f.admin, root.id, root.revision),
    (error) => error.status === 409,
  );
});

test("trash-held references block category deletion and inactive categories are not new choices", async (t) => {
  const f = await createContentEditingFixture(t),
    category = await f.editing.saveCategory(f.admin, null, validCategory(), null),
    post = await f.editing.saveDraft(f.admin, null, validDraft({ categoryId: category.id }), null);
  await f.editing.trashDraft(f.admin, post.id, post.revision);
  await assert.rejects(
    f.editing.removeUnusedCategory(f.admin, category.id, category.revision),
    (error) => error.status === 409 && /0 danh mục con.*1 bài/.test(error.message),
  );
  f.setActive({
    schemaVersion: 1,
    generationId: randomUUID(),
    posts: [],
    categories: [{ ...category, publicRevision: 1 }],
    redirects: {},
    media: {},
    routes: [],
    committedAt: "2026-11-01T00:00:00Z",
  });
  const inactive = await f.editing.saveCategory(
    f.admin,
    category.id,
    validCategory({ active: false }),
    category.revision,
  );
  assert.equal(inactive.active, false);
  assert.equal(inactive.publicRevision, 1);
  assert.equal((await f.activeRead()).categories[0].active, true);
  await assert.rejects(
    f.editing.saveDraft(
      f.editor,
      null,
      validDraft({ slug: "other", categoryId: category.id }),
      null,
    ),
    (error) => error.code === "CATEGORY_INACTIVE",
  );
});
