import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createContentEditingFixture, validDraft, validCategory } from "./helpers/content.mjs";
import { pngImage } from "./helpers/avatar-images.mjs";

test("two clients keep the latest working draft and an active public snapshot unchanged", async (t) => {
  const f = await createContentEditingFixture(t),
    category = await f.editing.saveCategory(f.admin, null, validCategory(), null);
  const first = await f.editing.saveDraft(
      f.editor,
      null,
      validDraft({ categoryId: category.id }),
      null,
    ),
    snapshot = {
      schemaVersion: 1,
      generationId: randomUUID(),
      posts: [
        {
          id: first.id,
          snapshotId: randomUUID(),
          draftRevision: 1,
          title: "Public title",
          slug: first.slug,
          publishedAt: "2026-11-01T00:00:00Z",
          modifiedAt: "2026-11-01T00:00:00Z",
        },
      ],
      categories: [{ ...category, publicRevision: 1 }],
      redirects: {},
      media: {},
      routes: [],
      committedAt: "2026-11-01T00:00:00Z",
    };
  f.setActive(snapshot);
  const a = await f.editing.get(f.editor, first.id),
    b = await f.editing.get(f.editor, first.id);
  const changed = await f.editing.saveDraft(
    f.editor,
    a.id,
    validDraft({ categoryId: category.id, title: "Edited" }),
    a.revision,
  );
  assert.equal(changed.revision, 2);
  await assert.rejects(
    f.editing.saveDraft(f.editor, b.id, validDraft({ title: "Stale" }), b.revision),
    (error) => error.status === 409,
  );
  assert.equal((await f.editing.get(f.editor, first.id)).title, "Edited");
  assert.equal(changed.public.draftRevision, 1);
  assert.deepEqual(await f.activeRead(), snapshot);
});

test("duplicate and trash/restore create only drafts; client publication flags are rejected", async (t) => {
  const f = await createContentEditingFixture(t),
    first = await f.editing.saveDraft(f.editor, null, validDraft(), null),
    duplicate = await f.editing.duplicate(f.editor, first.id);
  assert.notEqual(duplicate.id, first.id);
  assert.notEqual(duplicate.slug, first.slug);
  assert.equal(duplicate.public, null);
  const trashed = await f.editing.trashDraft(f.admin, first.id, first.revision);
  assert.ok(trashed.trashedAt);
  assert.equal(
    (await f.editing.list(f.admin, { page: 1, pageSize: 20, status: "trash" })).total,
    1,
  );
  const restored = await f.editing.restoreDraft(f.admin, first.id, trashed.revision);
  assert.equal(restored.trashedAt, null);
  assert.equal(restored.public, null);
  await assert.rejects(
    f.editing.saveDraft(f.admin, null, { ...validDraft(), status: "published" }, null),
    (error) => error.status === 400,
  );
});

test("draft revisions pin only existing media, normalize tags and never audit body bytes", async (t) => {
  const f = await createContentEditingFixture(t),
    image = await f.media.upload(f.admin, {
      bytes: pngImage(),
      mimeType: "image/png",
      originalName: "cover.png",
    });
  const article = await f.editing.saveDraft(
    f.editor,
    null,
    validDraft({
      coverMediaId: image.id,
      tags: [" Thiết kế ", "thiết kế", "Hoa", "Hoà"],
      content: JSON.stringify({
        format: "html-v1",
        html: `<h1>Draft secret body</h1><img data-media-id="${image.id}" alt="Image">`,
      }),
    }),
    null,
  );
  assert.equal(article.tags.length, 3);
  assert.match(JSON.parse(article.content).html, /<h2>/);
  const [references] = await f.pool.execute(
    "SELECT * FROM content_media_references WHERE owner_type='post' AND owner_id=?",
    [article.id],
  );
  assert.equal(references.length, 1);
  const [revisions] = await f.pool.execute("SELECT * FROM content_post_revisions WHERE post_id=?", [
    article.id,
  ]);
  assert.equal(revisions.length, 1);
  const [audit] = await f.pool.execute("SELECT metadata FROM audit_logs WHERE target_id=?", [
    article.id,
  ]);
  assert.ok(audit.length);
  const metadata =
    typeof audit[0].metadata === "string" ? JSON.parse(audit[0].metadata) : audit[0].metadata;
  assert.equal(metadata.revision, article.revision);
  assert.doesNotMatch(JSON.stringify(audit), /Draft secret body|base64|data:image/);
  await assert.rejects(
    f.editing.saveDraft(f.editor, null, validDraft({ coverMediaId: randomUUID() }), null),
    (error) => error.code === "INVALID_MEDIA_REFERENCE",
  );
});

test("draft changes never directly unpublish or trash an active public article", async (t) => {
  const f = await createContentEditingFixture(t),
    post = await f.editing.saveDraft(f.admin, null, validDraft(), null);
  f.setActive({
    schemaVersion: 1,
    generationId: randomUUID(),
    posts: [
      {
        id: post.id,
        snapshotId: randomUUID(),
        draftRevision: 1,
        slug: post.slug,
        publishedAt: "2026-11-01T00:00:00Z",
        modifiedAt: "2026-11-01T00:00:00Z",
      },
    ],
    categories: [],
    redirects: {},
    media: {},
    routes: [],
    committedAt: "2026-11-01T00:00:00Z",
  });
  await assert.rejects(
    f.editing.trashDraft(f.admin, post.id, post.revision),
    (error) => error.code === "PUBLICATION_REQUIRED",
  );
  assert.equal((await f.editing.get(f.admin, post.id)).trashedAt, null);
});

test("published ordering uses active publication dates and retains drafts at the end", async (t) => {
  const f = await createContentEditingFixture(t),
    older = await f.editing.saveDraft(f.admin, null, validDraft({ slug: "older" }), null),
    newer = await f.editing.saveDraft(f.admin, null, validDraft({ slug: "newer" }), null),
    draft = await f.editing.saveDraft(f.admin, null, validDraft({ slug: "draft" }), null);
  f.setActive({
    posts: [
      { ...older, draftRevision: 1, publishedAt: "2026-11-01T00:00:00Z" },
      { ...newer, draftRevision: 1, publishedAt: "2026-11-10T00:00:00Z" },
    ],
    categories: [],
  });
  await f.editing.saveDraft(
    f.admin,
    older.id,
    validDraft({ slug: older.slug, title: "Recent draft, older publication" }),
    older.revision,
  );
  const result = await f.editing.list(f.admin, { page: 1, pageSize: 2, sort: "published_desc" });
  assert.deepEqual(
    result.items.map((item) => item.id),
    [newer.id, older.id],
  );
  assert.equal(
    (await f.editing.list(f.admin, { page: 2, pageSize: 2, sort: "published_desc" })).items[0].id,
    draft.id,
  );
});
