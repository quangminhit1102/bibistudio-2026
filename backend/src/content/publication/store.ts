import {
  mkdir,
  open,
  rename,
  lstat,
  realpath,
  readdir,
  stat,
  statfs,
  unlink,
} from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type { ContentPaths, RenderedGeneration } from "../contracts";
import type { ContentEnvironmentLease } from "../environment-lock";
import { underContentEnvironmentLease } from "../environment-lock";
import { createContentMediaStore } from "../media/store";
import { publicAssetPath } from "../public-schema";
import { ApiError } from "../../http/errors";
import {
  digest,
  generationFile,
  parseGenerationManifest,
  readActiveContent,
  readGeneration,
  regularBytes,
} from "./active-read";
async function syncDirectory(directory: string) {
  if (process.platform === "win32") return;
  const f = await open(directory, "r");
  try {
    await f.sync();
  } finally {
    await f.close();
  }
}
async function size(directory: string): Promise<number> {
  let result = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isSymbolicLink()) continue;
    result += entry.isDirectory() ? await size(file) : (await stat(file)).size;
  }
  return result;
}
async function write(file: string, bytes: Uint8Array | string) {
  const f = await open(file, "wx", 0o600);
  try {
    await f.writeFile(bytes);
    await f.sync();
  } finally {
    await f.close();
  }
}
async function mutatePointer(work: () => Promise<void>, lease: ContentEnvironmentLease) {
  const deadline = Date.now() + 1000;
  for (;;) {
    lease.assertActive();
    try {
      await work();
      return;
    } catch (error) {
      // Windows can briefly deny replacement while a reader/filter holds the
      // target. Retry the atomic operation; never delete before a rename.
      if (
        process.platform !== "win32" ||
        !["EPERM", "EACCES", "EBUSY"].includes((error as NodeJS.ErrnoException).code ?? "") ||
        Date.now() >= deadline
      )
        throw error;
      await new Promise((done) => setTimeout(done, 25));
    }
  }
}
export function createGenerationStore(paths: ContentPaths, assetRoot: string) {
  const media = createContentMediaStore(paths);
  async function ready() {
    if (
      resolve(paths.active) !== join(resolve(paths.root), "active") ||
      resolve(paths.generations) !== join(resolve(paths.root), "generations")
    )
      throw Error("Invalid generation storage paths");
    for (const dir of [paths.root, paths.generations]) {
      if ((await realpath(dir)) !== resolve(dir) || (await lstat(dir)).isSymbolicLink())
        throw Error("Invalid generation storage directory");
    }
  }
  async function verify(id: string) {
    const result = await readGeneration(paths, id),
      dir = join(paths.generations, id);
    for (const [file, hash] of Object.entries(result.manifest.fileHashes)) {
      const bytes = await regularBytes(dir, file, paths.maxGenerationBytes);
      if (digest(bytes) !== hash) throw Error("Generation file integrity hash mismatch");
    }
    return result;
  }
  async function switchPointer(
    id: string | null,
    expected: string | null,
    lease: ContentEnvironmentLease,
  ) {
    await ready();
    await underContentEnvironmentLease(paths, lease, async () => {
      const active = await readActiveContent(paths);
      if ((active?.manifest.id ?? null) !== expected) throw Error("Active pointer conflict");
      if (id === null) {
        lease.assertActive();
        await mutatePointer(() => unlink(paths.active), lease);
        await syncDirectory(paths.root);
        return;
      }
      const next = await verify(id),
        temp = join(paths.root, ".active-" + randomUUID());
      await write(
        temp,
        JSON.stringify({ schemaVersion: 1, generationId: id, manifestSha256: next.manifestSha256 }),
      );
      try {
        lease.assertActive();
        await mutatePointer(() => rename(temp, paths.active), lease);
        await syncDirectory(paths.root);
      } finally {
        await unlink(temp).catch(() => {});
      }
    });
  }
  return {
    verify,
    async prepare(rendered: RenderedGeneration, lease: ContentEnvironmentLease) {
      await ready();
      return underContentEnvironmentLease(paths, lease, async () => {
        const manifest = parseGenerationManifest(rendered.manifest),
          manifestBytes = Buffer.from(JSON.stringify(manifest)),
          total =
            manifestBytes.length +
            [...rendered.files.values()].reduce((n, bytes) => n + bytes.length, 0);
        if (total > paths.maxGenerationBytes)
          throw new ApiError(503, "CONTENT_STORAGE_FULL", "Bản xuất bản vượt giới hạn lưu trữ");
        if (Object.keys(manifest.fileHashes).length !== rendered.files.size)
          throw Error("Generation files do not match manifest");
        for (const [file, bytes] of rendered.files)
          if (!generationFile(file) || digest(bytes) !== manifest.fileHashes[file])
            throw Error("Generation file integrity mismatch");
        for (const asset of manifest.assets) {
          if (!publicAssetPath(asset)) throw Error("Invalid generation asset");
          await regularBytes(assetRoot, asset.slice(1), 10 * 1024 ** 2);
        }
        for (const variant of Object.values(manifest.media))
          await media.read(variant.file.split("/")[0], variant);
        let managed = 0;
        for (const root of paths.managedRoots) managed += await size(root);
        const free = await statfs(paths.root);
        if (
          (await size(paths.root)) + total > paths.maxContentBytes ||
          managed + total + paths.minHeadroomBytes > paths.maxManagedBytes ||
          Number(free.bavail) * Number(free.bsize) < total + paths.minHeadroomBytes
        )
          throw new ApiError(503, "CONTENT_STORAGE_FULL", "Không đủ dung lượng xuất bản");
        const stage = join(paths.generations, ".staging-" + manifest.id),
          target = join(paths.generations, manifest.id);
        await mkdir(stage, { mode: 0o700 });
        for (const [file, bytes] of rendered.files) {
          await mkdir(dirname(join(stage, file)), { recursive: true, mode: 0o700 });
          await write(join(stage, file), bytes);
        }
        await write(join(stage, "manifest.json"), manifestBytes);
        if ([...rendered.files.keys()].some((file) => file.startsWith("pages/")))
          await syncDirectory(join(stage, "pages"));
        await syncDirectory(stage);
        lease.assertActive();
        await rename(stage, target);
        await syncDirectory(paths.generations);
        await verify(manifest.id);
        return { manifestSha256: digest(manifestBytes), bytes: total };
      });
    },
    activate: (id: string, expectedPreviousId: string | null, lease: ContentEnvironmentLease) =>
      switchPointer(id, expectedPreviousId, lease),
    restore: (
      expectedActiveId: string,
      previousId: string | null,
      lease: ContentEnvironmentLease,
    ) => switchPointer(previousId, expectedActiveId, lease),
  };
}
export type GenerationStore = ReturnType<typeof createGenerationStore>;
