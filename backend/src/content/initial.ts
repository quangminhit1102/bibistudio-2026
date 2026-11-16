import { randomUUID, createHash } from "node:crypto";
import { open, rename, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { z } from "zod";
import type { Pool, RowDataPacket } from "mysql2/promise";
import type { Clock } from "../config";
import type {
  ContentPaths,
  PublicAssetManifest,
  PublicSnapshot,
  PublishedPost,
  CategoryDto,
} from "./contracts";
import type { ContentMedia } from "./media/service";
import type { ContentEnvironmentLease } from "./environment-lock";
import { underContentEnvironmentLease } from "./environment-lock";
import { verifyContentSeed, seedId } from "./seed";
import { parsePublicSnapshot, publicOrigin } from "./public-schema";
import { jsonValue } from "./repository";
import { contentSchemaStatus } from "./schema";
import { withRbacWrite } from "../authorization/transaction";
import { writeAudit } from "../audit/repository";
import { renderContentGeneration } from "./render/document";
import { createGenerationStore } from "./publication/store";
import { readActiveContent, readGeneration, regularBytes, digest } from "./publication/active-read";
import { publicContentCanary } from "./publication/publisher";
import { createContentMediaStore } from "./media/store";
const journalSchema = z.strictObject({
  schemaVersion: z.literal(1),
  generationId: z.uuid(),
  manifestSha256: z.string().regex(/^[a-f0-9]{64}$/),
  bytes: z
    .number()
    .int()
    .positive()
    .max(64 * 1024 ** 2),
  seedSha256: z.string().regex(/^[a-f0-9]{64}$/),
  origin: z.string(),
  state: z.enum(["prepared", "activated", "committed", "failed"]),
});
type InitialJournal = z.infer<typeof journalSchema>;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export async function readInitialContentJournal(
  paths: ContentPaths,
): Promise<InitialJournal | null> {
  try {
    return journalSchema.parse(
      JSON.parse((await regularBytes(paths.root, "initial-cutover.json", 4096)).toString("utf8")),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
export function createInitialContent(options: {
  pool: Pool;
  clock: Clock;
  paths: ContentPaths;
  media: ContentMedia;
  assets: PublicAssetManifest;
  assetRoot: string;
  seedDirectory: string;
  origin: string;
}) {
  const { pool, clock, paths } = options,
    origin = publicOrigin(options.origin),
    store = createGenerationStore(paths, options.assetRoot),
    journalFile = join(paths.root, "initial-cutover.json");
  const journal = () => readInitialContentJournal(paths);
  async function save(value: InitialJournal, lease: ContentEnvironmentLease) {
    lease.assertActive();
    const next = join(paths.root, ".initial-" + randomUUID()),
      f = await open(next, "wx", 0o600);
    try {
      await f.writeFile(JSON.stringify(journalSchema.parse(value)));
      await f.sync();
    } finally {
      await f.close();
    }
    try {
      lease.assertActive();
      await rename(next, journalFile);
      if (process.platform !== "win32") {
        const dir = await open(paths.root, "r");
        try {
          await dir.sync();
        } finally {
          await dir.close();
        }
      }
    } finally {
      await unlink(next).catch((error) => {
        if (error.code !== "ENOENT") throw error;
      });
    }
  }
  async function schemaReady() {
    if (
      (await contentSchemaStatus(pool, resolve(__dirname, "../../content-migrations"))).state !==
      "complete"
    )
      throw Error("Compatible initial content schema required");
  }
  async function row(id: string) {
    return (
      await pool.execute<RowDataPacket[]>(
        "SELECT state,manifest_sha256,job_id,previous_id FROM content_generations WHERE id=?",
        [id],
      )
    )[0][0];
  }
  async function status() {
    await schemaReady();
    const state = await journal(),
      active = await readActiveContent(paths),
      known = state ? await row(state.generationId) : undefined;
    return {
      state: state?.state ?? "absent",
      generationId: state?.generationId ?? null,
      activeGenerationId: active?.manifest.id ?? null,
      committed: known?.state === "committed",
      initialized: state?.state === "committed" && !!active,
    };
  }
  async function candidates(): Promise<PublicSnapshot> {
    const seed = await verifyContentSeed(options.seedDirectory),
      posts: PublishedPost[] = [],
      categories = new Map<string, CategoryDto>();
    for (const source of seed.posts) {
      const postId = seedId("post", source.sourceKey),
        snapshotId = seedId("snapshot", source.sourceKey + ":1"),
        categoryKey = source.category.trim().normalize("NFC").toLocaleLowerCase("vi"),
        categoryId = seedId("category", categoryKey);
      const [[marker]] = await pool.execute<RowDataPacket[]>(
          "SELECT state,checksum FROM content_seed_imports WHERE id=?",
          [source.sourceKey],
        ),
        [[candidate]] = await pool.execute<RowDataPacket[]>(
          "SELECT snapshot_json FROM content_published_snapshots WHERE id=? AND post_id=? AND draft_revision=1",
          [snapshotId, postId],
        );
      if (
        marker?.state !== "complete" ||
        marker.checksum !== hash(JSON.stringify(source)) ||
        !candidate
      )
        throw Error("Original imported content candidates required");
      const post = jsonValue<PublishedPost>(candidate.snapshot_json),
        image = seed.images.find((image) => image.file === source.coverImage);
      if (
        !image ||
        post.id !== postId ||
        post.snapshotId !== snapshotId ||
        post.draftRevision !== 1 ||
        post.slug !== source.slug ||
        post.title !== source.title ||
        post.excerpt !== source.excerpt ||
        post.publishedAt !== source.date ||
        post.modifiedAt !== source.date ||
        post.categoryId !== categoryId ||
        post.coverMediaId !== seedId("media", image.sha256)
      )
        throw Error("Original content candidate identity mismatch");
      posts.push(post);
      if (!categories.has(categoryId)) {
        const [[revision]] = await pool.execute<RowDataPacket[]>(
          "SELECT data_json FROM content_category_revisions WHERE category_id=? AND revision=1",
          [categoryId],
        );
        if (!revision) throw Error("Original category revision required");
        const category = jsonValue<Omit<CategoryDto, "id" | "revision" | "publicRevision">>(
          revision.data_json,
        );
        if (
          category.name.trim().normalize("NFC").toLocaleLowerCase("vi") !== categoryKey ||
          category.parentId !== null ||
          category.active !== true
        )
          throw Error("Original category candidate mismatch");
        categories.set(categoryId, { ...category, id: categoryId, revision: 1, publicRevision: 1 });
      }
    }
    const media: PublicSnapshot["media"] = {};
    for (const image of await options.media.references([
      ...new Set(posts.flatMap((post) => post.mediaIds)),
    ]))
      for (const variant of image.variants) media[variant.file] = variant;
    return parsePublicSnapshot({
      schemaVersion: 1,
      generationId: randomUUID(),
      posts,
      categories: [...categories.values()],
      media,
      redirects: {},
      routes: [],
      committedAt: clock.now().toISOString(),
    });
  }
  async function persist(state: InitialJournal, lease: ContentEnvironmentLease) {
    const generation = await readGeneration(paths, state.generationId, state.manifestSha256);
    await withRbacWrite(
      pool,
      async (c) => {
        const [[existing]] = await c.execute<RowDataPacket[]>(
          "SELECT state,manifest_sha256,job_id,previous_id FROM content_generations WHERE id=? FOR UPDATE",
          [state.generationId],
        );
        if (existing) {
          if (
            existing.manifest_sha256 !== state.manifestSha256 ||
            existing.job_id !== null ||
            existing.previous_id !== null ||
            !["prepared", "verifying", "committed"].includes(existing.state)
          )
            throw Error("Incompatible initial generation ledger");
        } else
          await c.execute(
            "INSERT INTO content_generations(id,previous_id,job_id,state,manifest_sha256,bytes,created_at) VALUES(?,NULL,NULL,'prepared',?,?,?)",
            [state.generationId, state.manifestSha256, state.bytes, clock.now()],
          );
        for (const post of generation.snapshot.posts) {
          await c.execute(
            "INSERT IGNORE INTO content_generation_posts(generation_id,snapshot_id) VALUES(?,?)",
            [state.generationId, post.snapshotId],
          );
          for (const mediaId of post.mediaIds)
            await c.execute(
              "INSERT IGNORE INTO content_media_references(owner_type,owner_id,media_id) VALUES('generation',?,?)",
              [state.generationId, mediaId],
            );
        }
      },
      { beforeCommit: () => lease.assertActive() },
    );
    return generation;
  }
  async function pending(lease: ContentEnvironmentLease) {
    lease.assertActive();
    await schemaReady();
    const state = await journal();
    if (!state || state.state === "failed" || state.origin !== origin)
      throw Error("Matching prepared initial generation required");
    const known = await row(state.generationId);
    if (
      !known ||
      known.manifest_sha256 !== state.manifestSha256 ||
      known.job_id !== null ||
      known.previous_id !== null ||
      !["prepared", "verifying", "committed"].includes(known.state)
    )
      throw Error("Unknown initial content generation");
    return state;
  }
  return {
    status,
    prepare: (lease: ContentEnvironmentLease) =>
      underContentEnvironmentLease(paths, lease, async () => {
        await schemaReady();
        const previous = await journal(),
          active = await readActiveContent(paths);
        if (previous?.state === "committed") {
          if (!active || (await row(previous.generationId))?.state !== "committed")
            throw Error("Missing committed initial generation");
          return {
            generationId: active.manifest.id,
            manifestSha256: active.manifestSha256,
            alreadyInitialized: true,
          };
        }
        if (previous && previous.state !== "failed") {
          if (
            previous.origin !== origin ||
            (active && active.manifest.id !== previous.generationId)
          )
            throw Error("Unrelated active initial generation");
          const seed = await verifyContentSeed(options.seedDirectory);
          if (hash(JSON.stringify(seed)) !== previous.seedSha256)
            throw Error("Initial content seed changed during recovery");
          await persist(previous, lease);
          await store.verify(previous.generationId);
          return {
            generationId: previous.generationId,
            manifestSha256: previous.manifestSha256,
            alreadyInitialized: false,
          };
        }
        const [[history]] = await pool.query<RowDataPacket[]>(
          "SELECT COUNT(*) n FROM content_generations WHERE state='committed'",
        );
        if (active || Number(history.n))
          throw Error("Existing native content cannot be reset to initial seeds");
        const seed = await verifyContentSeed(options.seedDirectory),
          snapshot = await candidates(),
          receipt = await store.prepare(
            await renderContentGeneration(snapshot, options.assets, origin),
            lease,
          ),
          state: InitialJournal = {
            schemaVersion: 1,
            generationId: snapshot.generationId,
            manifestSha256: receipt.manifestSha256,
            bytes: receipt.bytes,
            seedSha256: hash(JSON.stringify(seed)),
            origin,
            state: "prepared",
          };
        await save(state, lease);
        await persist(state, lease);
        return {
          generationId: state.generationId,
          manifestSha256: state.manifestSha256,
          alreadyInitialized: false,
        };
      }),
    activate: (lease: ContentEnvironmentLease) =>
      underContentEnvironmentLease(paths, lease, async () => {
        const state = await pending(lease),
          active = await readActiveContent(paths);
        if (active && active.manifest.id !== state.generationId)
          throw Error("Unrelated initial pointer");
        if (!active) await store.activate(state.generationId, null, lease);
        if (state.state !== "committed") await save({ ...state, state: "activated" }, lease);
        return { generationId: state.generationId };
      }),
    verify: (lease: ContentEnvironmentLease) =>
      underContentEnvironmentLease(paths, lease, async () => {
        const state = await pending(lease),
          active = await readActiveContent(paths);
        if (
          active?.manifest.id !== state.generationId ||
          active.manifestSha256 !== state.manifestSha256
        )
          throw Error("Initial public generation mismatch");
        await store.verify(state.generationId);
        const media = createContentMediaStore(paths);
        for (const variant of Object.values(active.manifest.media))
          await media.read(variant.file.split("/")[0], variant);
        await publicContentCanary(paths, origin, active);
        for (const [key, variant] of Object.entries(active.manifest.media)) {
          const response = await fetch(new URL("/media/content/" + key, origin), {
            headers: { DNT: "1", "Cache-Control": "no-cache" },
            signal: AbortSignal.timeout(10000),
          });
          if (
            response.status !== 200 ||
            !response.headers.get("content-type")?.startsWith(variant.mime) ||
            digest(Buffer.from(await response.arrayBuffer())) !== variant.hash
          )
            throw Error("Initial public media canary failed");
        }
        for (const asset of active.manifest.assets) {
          const response = await fetch(new URL(asset, origin), {
            headers: { DNT: "1" },
            signal: AbortSignal.timeout(10000),
          });
          if (
            response.status !== 200 ||
            digest(Buffer.from(await response.arrayBuffer())) !==
              digest(await regularBytes(options.assetRoot, asset.slice(1), 10 * 1024 ** 2))
          )
            throw Error("Initial public asset canary failed");
        }
        await withRbacWrite(
          pool,
          async (c) => {
            const [[known]] = await c.execute<RowDataPacket[]>(
              "SELECT state,manifest_sha256 FROM content_generations WHERE id=? AND job_id IS NULL FOR UPDATE",
              [state.generationId],
            );
            if (
              !known ||
              known.manifest_sha256 !== state.manifestSha256 ||
              !["prepared", "verifying", "committed"].includes(known.state)
            )
              throw Error("Initial finalization ledger mismatch");
            if (known.state === "committed") return;
            await c.execute(
              "UPDATE content_generations SET state='committed',committed_at=COALESCE(committed_at,?) WHERE id=? AND job_id IS NULL AND state IN ('prepared','verifying','committed')",
              [clock.now(), state.generationId],
            );
            await writeAudit(c, {
              action: "content.seed.activate",
              targetType: "content_generation",
              targetId: state.generationId,
              metadata: { generationId: state.generationId, reason: "legacy-blog-seed" },
            });
          },
          { beforeCommit: () => lease.assertActive() },
        );
        await save({ ...state, state: "committed" }, lease);
        return { generationId: state.generationId, committed: true };
      }),
    restore: (lease: ContentEnvironmentLease) =>
      underContentEnvironmentLease(paths, lease, async () => {
        const state = await pending(lease),
          known = await row(state.generationId),
          active = await readActiveContent(paths);
        if (state.state === "committed" || known?.state === "committed")
          throw Error("Committed initial content requires recovery, not rollback");
        if (active && active.manifest.id !== state.generationId)
          throw Error("Cannot restore unrelated content pointer");
        if (active) await store.restore(state.generationId, null, lease);
        lease.assertActive();
        await pool.execute(
          "UPDATE content_generations SET state='failed' WHERE id=? AND job_id IS NULL AND state IN ('prepared','verifying')",
          [state.generationId],
        );
        await save({ ...state, state: "failed" }, lease);
        return { restored: true, generationId: state.generationId };
      }),
  };
}
