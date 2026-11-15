import test from "node:test";
import assert from "node:assert/strict";
import { createContentEditingFixture, validDraft, validCategory } from "./helpers/content.mjs";
import { syncContentPermissions } from "../dist/content/capabilities.js";

test("writers need post.view plus action and category management stays separate", async (t) => {
  const f = await createContentEditingFixture(t);
  await assert.rejects(
    f.editing.saveDraft(f.viewer, null, validDraft(), null),
    (error) => error.status === 403,
  );
  await assert.rejects(
    f.editing.saveCategory(f.editor, null, validCategory(), null),
    (error) => error.status === 403,
  );
  assert.equal(
    (await f.lookups.authors(f.editor, { page: 1, pageSize: 100 })).items.some(
      (item) => item.kind === "brand",
    ),
    true,
  );
  await f.pool.execute(
    "DELETE FROM role_permissions WHERE permission_id='post.view' AND role_id IN (SELECT role_id FROM user_roles WHERE user_id=?)",
    [f.editor.principal.id],
  );
  await assert.rejects(
    f.editing.saveDraft(f.editor, null, validDraft(), null),
    (error) => error.status === 403,
  );
  await assert.rejects(f.media.preflight(f.editor), (error) => error.status === 403);
});

test("category manager works without account or post management permissions", async (t) => {
  const f = await createContentEditingFixture(t),
    [[role]] = await f.pool.execute("SELECT role_id FROM user_roles WHERE user_id=?", [
      f.viewer.principal.id,
    ]);
  await f.pool.execute("DELETE FROM role_permissions WHERE role_id=?", [role.role_id]);
  for (const action of ["view", "create", "update", "delete"])
    await f.pool.execute("INSERT INTO role_permissions(role_id,permission_id) VALUES(?,?)", [
      role.role_id,
      "content_category." + action,
    ]);
  const category = await f.editing.saveCategory(f.viewer, null, validCategory(), null);
  assert.equal((await f.editing.getCategory(f.viewer, category.id)).id, category.id);
  await f.editing.removeUnusedCategory(f.viewer, category.id, category.revision);
  assert.equal((await f.editing.listCategories(f.viewer, { page: 1, pageSize: 20 })).total, 0);
  await assert.rejects(
    f.lookups.authors(f.viewer, { page: 1, pageSize: 20 }),
    (error) => error.status === 403,
  );
});

test("permission sync adds only missing definitions and preserves custom mappings", async (t) => {
  const f = await createContentEditingFixture(t),
    before = (
      await f.pool.query("SELECT * FROM role_permissions ORDER BY role_id,permission_id")
    )[0];
  assert.equal(
    (
      await f.pool.query("SELECT COUNT(*) n FROM permissions WHERE code='content_category.publish'")
    )[0][0].n,
    1,
  );
  await f.pool.execute("DELETE FROM permissions WHERE code='post.publish'");
  await syncContentPermissions(f.pool);
  await syncContentPermissions(f.pool);
  assert.equal(
    (await f.pool.query("SELECT COUNT(*) n FROM permissions WHERE code='post.publish'"))[0][0].n,
    1,
  );
  assert.deepEqual(
    (await f.pool.query("SELECT * FROM role_permissions ORDER BY role_id,permission_id"))[0],
    before,
  );
});
