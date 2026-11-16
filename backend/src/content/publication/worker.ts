import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type { Clock } from "../../config";
import type { ContentPaths, PublicAssetManifest } from "../contracts";
import type { ContentMedia } from "../media/service";
import { ApiError } from "../../http/errors";
import { withRbacWrite } from "../../authorization/transaction";
import { writeAudit } from "../../audit/repository";
import { withContentEnvironmentLock, type ContentEnvironmentLease } from "../environment-lock";
import { jsonValue } from "../repository";
import { renderContentGeneration } from "../render/document";
import { readActiveContent, readGeneration } from "./active-read";
import type { GenerationStore } from "./store";
import {
  authorizePublication,
  checkPublicationTarget,
  storedActor,
  validatePublicationRequest,
} from "./jobs";
import { capturePublication, planPublication, type PublicationPlan } from "./planner";
export type ActiveGeneration = NonNullable<Awaited<ReturnType<typeof readActiveContent>>>;
export interface PublicationContext {
  pool: Pool;
  clock: Clock;
  paths: ContentPaths;
  media: ContentMedia;
  assets: PublicAssetManifest;
  origin: string;
  store: GenerationStore;
  render: typeof renderContentGeneration;
  canary: (active: ActiveGeneration | null) => Promise<void>;
  assertWritable: () => Promise<void>;
}
async function update(
  context: PublicationContext,
  id: string,
  status: string,
  error: { code: string; message: string } | null = null,
) {
  await context.pool.execute(
    "UPDATE content_publication_jobs SET status=?,error_json=?,updated_at=?,completed_at=? WHERE id=? AND status NOT IN ('succeeded','failed')",
    [
      status,
      error ? JSON.stringify(error) : null,
      context.clock.now(),
      status === "failed" ? context.clock.now() : null,
      id,
    ],
  );
}
async function persist(
  context: PublicationContext,
  c: PoolConnection,
  row: RowDataPacket,
  plan: PublicationPlan,
  receipt: { manifestSha256: string; bytes: number },
  previousId: string | null,
) {
  const { snapshot, newPost } = plan;
  if (newPost) {
    await c.execute(
      "INSERT IGNORE INTO content_published_snapshots(id,post_id,draft_revision,snapshot_json,created_at) VALUES(?,?,?,?,?)",
      [
        newPost.snapshotId,
        newPost.id,
        newPost.draftRevision,
        JSON.stringify(newPost),
        context.clock.now(),
      ],
    );
    for (const mediaId of newPost.mediaIds)
      await c.execute(
        "INSERT IGNORE INTO content_media_references(owner_type,owner_id,media_id) VALUES('snapshot',?,?)",
        [newPost.snapshotId, mediaId],
      );
  }
  await c.execute(
    "INSERT INTO content_generations(id,previous_id,job_id,state,manifest_sha256,bytes,created_at) VALUES(?,?,?,'prepared',?,?,?)",
    [
      snapshot.generationId,
      previousId,
      row.id,
      receipt.manifestSha256,
      receipt.bytes,
      context.clock.now(),
    ],
  );
  for (const post of snapshot.posts) {
    await c.execute("INSERT INTO content_generation_posts(generation_id,snapshot_id) VALUES(?,?)", [
      snapshot.generationId,
      post.snapshotId,
    ]);
    for (const mediaId of post.mediaIds)
      await c.execute(
        "INSERT IGNORE INTO content_media_references(owner_type,owner_id,media_id) VALUES('generation',?,?)",
        [snapshot.generationId, mediaId],
      );
  }
  await c.execute(
    "UPDATE content_publication_jobs SET status='prepared',generation_id=?,previous_generation_id=?,updated_at=? WHERE id=?",
    [snapshot.generationId, previousId, context.clock.now(), row.id],
  );
}
async function verifyPrepared(context: PublicationContext, row: RowDataPacket) {
  const generation = await context.store.verify(String(row.generation_id));
  const [[known]] = await context.pool.execute<RowDataPacket[]>(
    "SELECT * FROM content_generations WHERE id=? AND job_id=?",
    [row.generation_id, row.id],
  );
  if (
    !known ||
    known.manifest_sha256 !== generation.manifestSha256 ||
    generation.manifest.previousId !== (row.previous_generation_id ?? null)
  )
    throw Error("Unknown prepared content generation");
  return generation;
}
async function finalize(
  context: PublicationContext,
  row: RowDataPacket,
  active: ActiveGeneration,
  lease: ContentEnvironmentLease,
) {
  await withRbacWrite(
    context.pool,
    async (c) => {
      const [[current]] = await c.execute<RowDataPacket[]>(
        "SELECT status FROM content_publication_jobs WHERE id=? FOR UPDATE",
        [row.id],
      );
      if (current.status === "succeeded") return;
      if ((await readActiveContent(context.paths))?.manifest.id !== active.manifest.id)
        throw Error("Active pointer changed during finalize");
      const input = validatePublicationRequest(jsonValue(row.request_json));
      if (input.action === "trash" || input.action === "delete-category")
        await checkPublicationTarget(c, input);
      if (input.action === "trash")
        await c.execute(
          "UPDATE content_posts SET trashed_at=COALESCE(trashed_at,?),updated_at=? WHERE id=?",
          [context.clock.now(), context.clock.now(), input.targetId],
        );
      if (input.action === "delete-category") {
        await c.execute("DELETE FROM content_category_revisions WHERE category_id=?", [
          input.targetId,
        ]);
        await c.execute("DELETE FROM content_categories WHERE id=?", [input.targetId]);
      }
      await c.execute("UPDATE content_categories SET public_revision=NULL");
      for (const category of active.snapshot.categories)
        await c.execute("UPDATE content_categories SET public_revision=? WHERE id=?", [
          category.revision,
          category.id,
        ]);
      await c.execute(
        "UPDATE content_generations SET state='committed',committed_at=COALESCE(committed_at,?) WHERE id=?",
        [context.clock.now(), active.manifest.id],
      );
      await c.execute(
        "UPDATE content_publication_jobs SET status='succeeded',error_json=NULL,completed_at=?,updated_at=? WHERE id=?",
        [context.clock.now(), context.clock.now(), row.id],
      );
      await writeAudit(c, {
        actorId: String(row.actor_id),
        action: "content.publication.success",
        targetType: "content_job",
        targetId: String(row.id),
        metadata: { revision: Number(row.expected_revision), generationId: active.manifest.id },
      });
    },
    { beforeCommit: () => lease.assertActive() },
  );
}
export async function runNextPublication(context: PublicationContext): Promise<boolean> {
  return withContentEnvironmentLock(context.paths, async (lease) => {
    await context.assertWritable();
    const [[row]] = await context.pool.query<RowDataPacket[]>(
      "SELECT * FROM content_publication_jobs WHERE status IN ('queued','building','prepared','verifying') ORDER BY (status='queued'),created_at,id LIMIT 1",
    );
    if (!row) return false;
    let generationId: string | null = row.generation_id ?? null,
      previousId: string | null = row.previous_generation_id ?? null;
    try {
      let active = await readActiveContent(context.paths);
      const input = validatePublicationRequest(jsonValue(row.request_json));
      if (!generationId) {
        await update(context, String(row.id), "building");
        previousId = active?.manifest.id ?? null;
        const captured = await withRbacWrite(context.pool, async (c) => {
          const actor = await storedActor(c, row);
          await authorizePublication(c, actor, input, context.clock);
          return capturePublication(c, input, active?.snapshot ?? null);
        });
        for (const entry of captured.historyGenerations) {
          const generation = await readGeneration(context.paths, entry.id, entry.hash),
            category = generation.snapshot.categories.find(
              (item) => item.id === captured.targetCategory?.id,
            );
          if (category) captured.categoryAliases.push(category.slug);
        }
        const plan = await planPublication(captured, input, context.media, context.clock),
          rendered = await context.render(
            plan.snapshot,
            context.assets,
            context.origin,
            previousId,
          ),
          receipt = await context.store.prepare(rendered, lease);
        await withRbacWrite(
          context.pool,
          async (c) => {
            const actor = await storedActor(c, row);
            await authorizePublication(c, actor, input, context.clock);
            await checkPublicationTarget(c, input);
            await persist(context, c, row, plan, receipt, previousId);
          },
          { beforeCommit: () => lease.assertActive() },
        );
        generationId = rendered.manifest.id;
        row.generation_id = generationId;
        row.previous_generation_id = previousId;
        row.status = "prepared";
      }
      await verifyPrepared(context, row);
      active = await readActiveContent(context.paths);
      if (active?.manifest.id !== generationId) {
        if ((active?.manifest.id ?? null) !== previousId || row.status === "verifying")
          throw Error("Publication active pointer conflict");
        await withRbacWrite(
          context.pool,
          async (c) => {
            const actor = await storedActor(c, row);
            await authorizePublication(c, actor, input, context.clock);
            await checkPublicationTarget(c, input);
            await c.execute(
              "UPDATE content_publication_jobs SET status='verifying',updated_at=? WHERE id=?",
              [context.clock.now(), row.id],
            );
            await c.execute("UPDATE content_generations SET state='verifying' WHERE id=?", [
              generationId,
            ]);
            await context.assertWritable();
            lease.assertActive();
            await context.store.activate(generationId!, previousId, lease);
          },
          { beforeCommit: () => lease.assertActive() },
        );
      }
      active = await readActiveContent(context.paths);
      if (active?.manifest.id !== generationId) throw Error("Activated content pointer missing");
      await context.canary(active);
      lease.assertActive();
      await finalize(context, row, active, lease);
      return true;
    } catch (error) {
      // An activation error can occur AFTER rename. Always inspect the authoritative pointer.
      const active = await readActiveContent(context.paths);
      if (generationId && active?.manifest.id === generationId) {
        try {
          await context.store.restore(generationId, previousId, lease);
          const restored = await readActiveContent(context.paths);
          if ((restored?.manifest.id ?? null) !== previousId)
            throw Error("Restore pointer mismatch");
          await context.canary(restored);
        } catch {
          await update(context, String(row.id), "verifying", {
            code: "PUBLICATION_RECOVERY_REQUIRED",
            message: "Khôi phục xuất bản chưa hoàn tất; cần kiểm tra vận hành",
          });
          throw new ApiError(
            503,
            "PUBLICATION_RECOVERY_REQUIRED",
            "Khôi phục xuất bản chưa hoàn tất",
          );
        }
      }
      const code = error instanceof ApiError ? error.code : "PUBLICATION_FAILED";
      await withRbacWrite(
        context.pool,
        async (c) => {
          const [[latest]] = await c.execute<RowDataPacket[]>(
            "SELECT status FROM content_publication_jobs WHERE id=? FOR UPDATE",
            [row.id],
          );
          if (latest.status === "succeeded" || latest.status === "failed") return;
          await c.execute(
            "UPDATE content_publication_jobs SET status='failed',error_json=?,updated_at=?,completed_at=? WHERE id=?",
            [
              JSON.stringify({
                code,
                message:
                  error instanceof ApiError
                    ? error.message
                    : "Xuất bản thất bại. Bản công khai trước được giữ nguyên.",
              }),
              context.clock.now(),
              context.clock.now(),
              row.id,
            ],
          );
          if (generationId)
            await c.execute("UPDATE content_generations SET state='failed' WHERE id=?", [
              generationId,
            ]);
          await writeAudit(c, {
            actorId: String(row.actor_id),
            action: "content.publication.failed",
            targetType: "content_job",
            targetId: String(row.id),
            metadata: {
              revision: Number(row.expected_revision),
              reason: code,
              ...(generationId ? { generationId } : {}),
            },
          });
        },
        { beforeCommit: () => lease.assertActive() },
      );
      return true;
    }
  });
}
