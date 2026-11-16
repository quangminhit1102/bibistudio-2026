import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  createPublicationFixture,
  publicationRequest,
  postInput,
} from "./helpers/content-publication.mjs";
import { createDatabaseFixture } from "./helpers/database.mjs";
import { bridge } from "./helpers/native-backup.mjs";
import { runNativeTool } from "../dist/db/backup.js";
import { createApp } from "../dist/app.js";
import { serve } from "./helpers/http.mjs";
import { pngImage } from "./helpers/avatar-images.mjs";
import { resolve, dirname } from "node:path";
test("backup reserves both SQL dumps and runtime headroom before invoking native tools", async (t) => {
  const { createContentBackup } = await import("../dist/content/backup.js"),
    f = await createPublicationFixture(t),
    verify = await createDatabaseFixture(t),
    assetDirectory = join(f.paths.root, "profiles");
  await mkdir(assetDirectory, { mode: 0o700 });
  f.paths.maxManagedBytes = 512 * 1024 ** 2;
  let tools = 0;
  await assert.rejects(
    createContentBackup({
      pool: f.pool,
      database: f.database,
      verifyDatabase: verify.config.database,
      directory: join(f.paths.root, "backups"),
      assetDirectory,
      paths: f.paths,
      assetRoot: f.assetRoot,
      releaseId: "f".repeat(40) + "-123",
      flavor: "mariadb",
      runTool: async (kind, args, io) => {
        tools++;
        await bridge(kind, args, io, runNativeTool);
      },
    }),
    /budget|headroom/i,
  );
  assert.equal(tools, 0);
});
test("paired native restore preserves private draft, public snapshot, jobs, media, generations and pointer", async (t) => {
  const { createContentBackup } = await import("../dist/content/backup.js"),
    f = await createPublicationFixture(t),
    verify = await createDatabaseFixture(t),
    post = await f.makePost("backup-public"),
    job = await f.publication.request(f.admin, publicationRequest(post));
  await f.publication.reconcile();
  assert.equal((await f.publication.status(f.admin, job.id)).status, "succeeded");
  const renamed = await f.editing.saveDraft(
      f.admin,
      post.id,
      postInput(post, { slug: "backup-renamed" }),
      post.revision,
    ),
    renameJob = await f.publication.request(f.admin, publicationRequest(renamed));
  await f.publication.reconcile();
  assert.equal((await f.publication.status(f.admin, renameJob.id)).status, "succeeded");
  await f.editing.saveDraft(
    f.admin,
    post.id,
    postInput(renamed, { title: "private new draft" }),
    renamed.revision,
  );
  const assetDirectory = join(f.paths.root, "profiles"),
    directory = join(f.paths.root, "backups");
  await mkdir(assetDirectory, { mode: 0o700 });
  const base = await serve(
      t,
      createApp(
        { releaseId: "content-backup-profile", sourceSha: "test" },
        {
          db: f.pool,
          config: f.config,
          clock: f.clock,
          profiles: { schemaDirectory: resolve("backend/profile-migrations"), assetDirectory },
        },
      ),
    ),
    grant = await f.auth.login({ username: "user01", password: f.secrets.userPassword }),
    avatarResponse = await fetch(base + "/api/profile/avatar", {
      method: "PUT",
      headers: {
        Authorization: "Bearer " + grant.accessToken,
        Origin: f.config.allowedOrigins[0],
        "X-Bibi-Request": "1",
        "Content-Type": "image/png",
        "If-Match": '"1"',
      },
      body: pngImage(),
    });
  assert.equal(avatarResponse.status, 200);
  const avatar = await avatarResponse.json();
  const bootstrapFile = join(f.paths.root, "content-reader.json");
  await writeFile(bootstrapFile, '{"fixture":"private reader configuration"}', { mode: 0o600 });
  let checked = false;
  const receipt = await createContentBackup({
    pool: f.pool,
    database: f.database,
    verifyDatabase: verify.config.database,
    directory,
    assetDirectory,
    paths: f.paths,
    assetRoot: f.assetRoot,
    bootstrapFiles: { "content-reader.json": bootstrapFile },
    releaseId: "c".repeat(40) + "-123",
    flavor: "mariadb",
    runTool: (kind, args, io) => bridge(kind, args, io, runNativeTool),
    verifyRestored: async (connection, database) => {
      const [[draft]] = await connection.query(
        `SELECT JSON_UNQUOTE(JSON_EXTRACT(draft_json,'$.title')) title FROM \`${database}\`.content_posts WHERE id=?`,
        [post.id],
      );
      assert.equal(draft.title, "private new draft");
      const [[jobs]] = await connection.query(
        `SELECT COUNT(*) n FROM \`${database}\`.content_publication_jobs WHERE status='succeeded'`,
      );
      assert.ok(jobs.n >= 3);
      const [[alias]] = await connection.query(
        `SELECT target_id FROM \`${database}\`.content_slug_reservations WHERE kind='post' AND slug='backup-public'`,
      );
      assert.equal(alias.target_id, post.id);
      const [[user]] = await connection.query(
        `SELECT avatar_id FROM \`${database}\`.users WHERE username='user01'`,
      );
      assert.equal(user.avatar_id, avatar.avatarId);
      checked = true;
    },
  });
  assert.equal(checked, true);
  assert.equal(receipt.verified, true);
  assert.equal(receipt.profiles, true);
  assert.equal(receipt.content, true);
  assert.equal(receipt.assetCount, 1);
  assert.equal(
    await readFile(
      join(dirname(receipt.contentDirectory), "bootstrap/content-reader.json"),
      "utf8",
    ),
    '{"fixture":"private reader configuration"}',
  );
  assert.deepEqual(
    await readFile(join(receipt.assetsDirectory, avatar.avatarId + ".png")),
    await readFile(join(assetDirectory, avatar.avatarId + ".png")),
  );
  const pointer = JSON.parse(await readFile(f.paths.active, "utf8"));
  assert.equal(receipt.generationId, pointer.generationId);
  assert.equal(
    await readFile(join(receipt.contentDirectory, "active"), "utf8"),
    await readFile(f.paths.active, "utf8"),
  );
  const [[remaining]] = await verify.pool.query(
    "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE()",
  );
  assert.equal(remaining.n, 0);
});
test("backup lease blocks decoded uploads until the paired dump and file verification finish", async (t) => {
  const { createContentBackup } = await import("../dist/content/backup.js"),
    { createContentMedia } = await import("../dist/content/media/service.js"),
    { normalizeContentImage } = await import("../dist/content/media/codec.js"),
    f = await createPublicationFixture(t),
    verify = await createDatabaseFixture(t),
    image = pngImage(),
    encoded = await normalizeContentImage(image, "image/png"),
    decoded = Promise.withResolvers();
  const media = createContentMedia({
      ...f,
      codec: async () => {
        decoded.resolve();
        return encoded;
      },
    }),
    assetDirectory = join(f.paths.root, "profiles");
  await mkdir(assetDirectory, { mode: 0o700 });
  const [[before]] = await f.pool.query("SELECT COUNT(*) n FROM content_media");
  let upload,
    checked = false;
  try {
    const receipt = await createContentBackup({
      pool: f.pool,
      database: f.database,
      verifyDatabase: verify.config.database,
      directory: join(f.paths.root, "backups"),
      assetDirectory,
      paths: f.paths,
      assetRoot: f.assetRoot,
      releaseId: "d".repeat(40) + "-123",
      flavor: "mariadb",
      runTool: async (kind, args, io) => {
        if (!upload && kind === "dump") {
          upload = media.upload(f.admin, {
            originalName: "during-backup.png",
            mimeType: "image/png",
            bytes: image,
          });
          await decoded.promise;
          await new Promise((done) => setTimeout(done, 100));
          const [[during]] = await f.pool.query("SELECT COUNT(*) n FROM content_media");
          assert.equal(during.n, before.n);
          checked = true;
        }
        await bridge(kind, args, io, runNativeTool);
      },
    });
    assert.equal(receipt.content, true);
    assert.equal(checked, true);
  } finally {
    await upload;
  }
  const [[after]] = await f.pool.query("SELECT COUNT(*) n FROM content_media");
  assert.equal(after.n, before.n + 1);
});
test("corrupt copied content blocks the backup receipt and verifier is cleared without touching source", async (t) => {
  const { createContentBackup } = await import("../dist/content/backup.js"),
    { writeFile } = await import("node:fs/promises"),
    f = await createPublicationFixture(t),
    verify = await createDatabaseFixture(t),
    assetDirectory = join(f.paths.root, "profiles");
  await mkdir(assetDirectory, { mode: 0o700 });
  const [[variant]] = await f.pool.query("SELECT file FROM content_media_variants LIMIT 1"),
    original = await readFile(join(f.paths.media, variant.file));
  let injected = false;
  await assert.rejects(
    createContentBackup({
      pool: f.pool,
      database: f.database,
      verifyDatabase: verify.config.database,
      directory: join(f.paths.root, "backups"),
      assetDirectory,
      paths: f.paths,
      assetRoot: f.assetRoot,
      releaseId: "e".repeat(40) + "-123",
      flavor: "mariadb",
      runTool: async (kind, args, io) => {
        await bridge(kind, args, io, runNativeTool);
        if (kind === "restore") {
          await writeFile(
            join(dirname(io.inputFile), "content/media", variant.file),
            "corrupt copy",
          );
          injected = true;
        }
      },
    }),
    /checksum/i,
  );
  assert.equal(injected, true);
  assert.deepEqual(await readFile(join(f.paths.media, variant.file)), original);
  const [[remaining]] = await verify.pool.query(
    "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE()",
  );
  assert.equal(remaining.n, 0);
});
