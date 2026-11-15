import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  createPublicationFixture,
  publicationRequest,
  postInput,
} from "./helpers/content-publication.mjs";
import { runNextPublication } from "../dist/content/publication/worker.js";
import { readActiveContent } from "../dist/content/publication/active-read.js";
import { validDraft, validCategory } from "./helpers/content.mjs";

test("retry is idempotent and stale render never activates", async (t) => {
  const f = await createPublicationFixture(t),
    post = await f.makePost("first"),
    input = publicationRequest(post);
  const job = await f.publication.request(f.admin, input);
  assert.equal((await f.publication.request(f.admin, input)).id, job.id);
  await assert.rejects(
    f.publication.request(f.admin, { ...input, action: "unpublish" }),
    (e) => e.status === 409,
  );
  await f.editing.saveDraft(
    f.admin,
    post.id,
    postInput(post, { title: "new draft" }),
    post.revision,
  );
  await runNextPublication(f.context);
  assert.equal((await f.publication.status(f.admin, job.id)).status, "failed");
  assert.equal((await readActiveContent(f.paths)).manifest.id, f.previousId);
});
test("different queued posts survive, and draft save never changes the public revision", async (t) => {
  const f = await createPublicationFixture(t),
    a = await f.makePost("first"),
    b = await f.makePost("second");
  const jobs = await Promise.all(
    [a, b].map((p) => f.publication.request(f.admin, publicationRequest(p))),
  );
  await Promise.all([runNextPublication(f.context), runNextPublication(f.context)]);
  const active = await readActiveContent(f.paths);
  assert.deepEqual(new Set(active.snapshot.posts.map((p) => p.id)), new Set([a.id, b.id]));
  for (const job of jobs)
    assert.equal((await f.publication.status(f.admin, job.id)).status, "succeeded");
  await f.editing.saveDraft(f.admin, a.id, postInput(a, { title: "private revision" }), a.revision);
  assert.equal(
    (await readActiveContent(f.paths)).snapshot.posts.find((p) => p.id === a.id).title,
    a.title,
  );
  assert.equal(f.canaries.length, 2);
  const [[audit]] = await f.pool.query(
    "SELECT metadata FROM audit_logs WHERE action='content.publication.success' AND target_id=?",
    [jobs[0].id],
  );
  const metadata = typeof audit.metadata === "string" ? JSON.parse(audit.metadata) : audit.metadata;
  assert.ok(metadata.generationId);
});
test("render, storage, missing asset and canary failures preserve a complete old generation", async (t) => {
  for (const fault of ["render", "disk", "asset", "canary"]) {
    await t.test(fault, async (t) => {
      const f = await createPublicationFixture(t),
        post = await f.makePost("first"),
        job = await f.publication.request(f.admin, publicationRequest(post));
      if (fault === "render")
        f.context.render = async () => {
          throw Error("renderer private detail");
        };
      if (fault === "disk") f.paths.maxGenerationBytes = 1;
      if (fault === "asset") await f.removeAsset();
      if (fault === "canary")
        f.context.canary = async (active) => {
          if (active.manifest.id !== f.previousId) throw Error("stale HTTP");
        };
      await runNextPublication(f.context);
      const result = await f.publication.status(f.admin, job.id);
      assert.equal(result.status, "failed");
      assert.doesNotMatch(JSON.stringify(result), /private detail|stale HTTP/);
      assert.equal((await readActiveContent(f.paths)).manifest.id, f.previousId);
    });
  }
});
test("fresh authority and exact working revision are rechecked after rendering", async (t) => {
  for (const fault of ["revision", "session"]) {
    await t.test(fault, async (t) => {
      const f = await createPublicationFixture(t),
        post = await f.makePost("first"),
        job = await f.publication.request(f.admin, publicationRequest(post)),
        render = f.context.render;
      f.context.render = async (...args) => {
        const value = await render(...args);
        if (fault === "revision")
          await f.editing.saveDraft(
            f.admin,
            post.id,
            postInput(post, { title: "changed" }),
            post.revision,
          );
        else
          await f.pool.execute("UPDATE refresh_token_sessions SET revoked_at=? WHERE id=?", [
            f.clock.now(),
            f.admin.sid,
          ]);
        return value;
      };
      await runNextPublication(f.context);
      const [[row]] = await f.pool.query("SELECT status FROM content_publication_jobs WHERE id=?", [
        job.id,
      ]);
      assert.equal(row.status, "failed");
      assert.equal((await readActiveContent(f.paths)).manifest.id, f.previousId);
    });
  }
});
test("category public dependencies and delete plus publish authority cannot be bypassed", async (t) => {
  const f = await createPublicationFixture(t),
    post = await f.makePost("first"),
    category = await f.editing.saveCategory(
      f.admin,
      null,
      validCategory({ slug: "unpublished-parent" }),
      null,
    );
  const child = await f.editing.saveCategory(
    f.admin,
    null,
    validCategory({ slug: "child", parentId: category.id }),
    null,
  );
  const request = {
    action: "apply-category",
    targetId: child.id,
    expectedRevision: child.revision,
    idempotencyKey: randomUUID(),
  };
  await assert.rejects(f.publication.request(f.editor, request), (e) => e.status === 403);
  const job = await f.publication.request(f.admin, request);
  await runNextPublication(f.context);
  assert.equal((await f.publication.status(f.admin, job.id)).status, "failed");
  await assert.rejects(
    f.publication.request(f.editor, { ...publicationRequest(post), action: "trash" }),
    (e) => e.status === 403,
  );
  const published = await f.publication.request(f.admin, publicationRequest(post));
  await runNextPublication(f.context);
  assert.equal((await f.publication.status(f.admin, published.id)).status, "succeeded");
  const renamed = await f.editing.saveDraft(
    f.admin,
    post.id,
    postInput(post, { slug: "renamed" }),
    post.revision,
  );
  await f.publication.request(f.admin, publicationRequest(renamed));
  await runNextPublication(f.context);
  let active = await readActiveContent(f.paths);
  assert.equal(active.manifest.routes["/blog/first"].location, "/blog/renamed");
  await f.publication.request(f.admin, { ...publicationRequest(renamed), action: "unpublish" });
  await runNextPublication(f.context);
  active = await readActiveContent(f.paths);
  assert.equal(active.snapshot.posts.length, 0);
  assert.equal(active.manifest.routes["/blog/renamed"], undefined);
  assert.ok(Object.keys(active.manifest.media).length > 0);
  const restored = await f.editing.saveDraft(
    f.admin,
    renamed.id,
    postInput(renamed, { slug: "final-name" }),
    renamed.revision,
  );
  await f.publication.request(f.admin, publicationRequest(restored));
  await runNextPublication(f.context);
  active = await readActiveContent(f.paths);
  assert.equal(active.manifest.routes["/blog/first"].location, "/blog/final-name");
  assert.equal(active.manifest.routes["/blog/renamed"].location, "/blog/final-name");
});

test("an existing public article can keep its inactive category when updated", async (t) => {
  const f = await createPublicationFixture(t),
    post = await f.makePost("inactive-retained");
  await f.publication.request(f.admin, publicationRequest(post));
  await runNextPublication(f.context);
  const category = await f.editing.getCategory(f.admin, post.categoryId),
    input = Object.fromEntries(Object.keys(validCategory()).map((key) => [key, category[key]])),
    saved = await f.editing.saveCategory(
      f.admin,
      category.id,
      { ...input, active: false },
      category.revision,
    );
  await f.publication.request(f.admin, {
    action: "apply-category",
    targetId: saved.id,
    expectedRevision: saved.revision,
    idempotencyKey: randomUUID(),
  });
  await runNextPublication(f.context);
  const updated = await f.editing.saveDraft(
      f.admin,
      post.id,
      postInput(post, { title: "Updated in hidden category" }),
      post.revision,
    ),
    job = await f.publication.request(f.admin, publicationRequest(updated));
  await runNextPublication(f.context);
  assert.equal((await f.publication.status(f.admin, job.id)).status, "succeeded");
  assert.equal(
    (await readActiveContent(f.paths)).snapshot.posts.find((p) => p.id === post.id).title,
    updated.title,
  );
});

test("public trash and unused category deletion finalize only after canary", async (t) => {
  const f = await createPublicationFixture(t),
    post = await f.makePost("trash-post");
  await f.publication.request(f.admin, publicationRequest(post));
  await runNextPublication(f.context);
  const trash = await f.publication.request(f.admin, {
    ...publicationRequest(post),
    action: "trash",
  });
  await runNextPublication(f.context);
  assert.equal((await f.publication.status(f.admin, trash.id)).status, "succeeded");
  assert.ok((await f.editing.get(f.admin, post.id)).trashedAt);
  assert.equal((await readActiveContent(f.paths)).snapshot.posts.length, 0);
  const category = await f.editing.saveCategory(
    f.admin,
    null,
    validCategory({ slug: "unused" }),
    null,
  );
  await f.publication.request(f.admin, {
    action: "apply-category",
    targetId: category.id,
    expectedRevision: category.revision,
    idempotencyKey: randomUUID(),
  });
  await runNextPublication(f.context);
  const removed = await f.publication.request(f.admin, {
    action: "delete-category",
    targetId: category.id,
    expectedRevision: category.revision,
    idempotencyKey: randomUUID(),
  });
  await runNextPublication(f.context);
  assert.equal((await f.publication.status(f.admin, removed.id)).status, "succeeded");
  await assert.rejects(f.editing.getCategory(f.admin, category.id), (e) => e.status === 404);
  assert.equal(
    (await readActiveContent(f.paths)).snapshot.categories.some((c) => c.id === category.id),
    false,
  );
});

test("publication atomically applies the selected category revision and respects revoked publish permission", async (t) => {
  const f = await createPublicationFixture(t),
    post = await f.makePost("combined"),
    category = await f.editing.getCategory(f.admin, post.categoryId),
    input = validCategory({
      ...Object.fromEntries(Object.keys(validCategory()).map((key) => [key, category[key]])),
      name: "Tên công khai mới",
    }),
    saved = await f.editing.saveCategory(f.admin, category.id, input, category.revision);
  const job = await f.publication.request(f.admin, {
    ...publicationRequest(post),
    categoryRevisionToApply: saved.revision,
  });
  await runNextPublication(f.context);
  assert.equal((await f.publication.status(f.admin, job.id)).status, "succeeded");
  const active = await readActiveContent(f.paths);
  assert.equal(active.snapshot.posts[0].id, post.id);
  assert.equal(
    active.snapshot.categories.find((c) => c.id === category.id).revision,
    saved.revision,
  );
  const [[role]] = await f.pool.execute("SELECT role_id FROM user_roles WHERE user_id=?", [
    f.editor.principal.id,
  ]);
  await f.pool.execute(
    "INSERT INTO role_permissions(role_id,permission_id) VALUES(?,'post.publish')",
    [role.role_id],
  );
  const next = await f.makePost("revoked-permission"),
    revoked = await f.publication.request(f.editor, publicationRequest(next)),
    render = f.context.render;
  f.context.render = async (...args) => {
    const value = await render(...args);
    await f.pool.execute(
      "DELETE FROM role_permissions WHERE role_id=? AND permission_id='post.publish'",
      [role.role_id],
    );
    return value;
  };
  await runNextPublication(f.context);
  assert.equal((await f.publication.status(f.editor, revoked.id)).status, "failed");
  assert.equal((await readActiveContent(f.paths)).manifest.id, active.manifest.id);
});
