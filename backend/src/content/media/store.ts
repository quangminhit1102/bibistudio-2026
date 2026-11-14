import { constants } from "node:fs";
import {
  mkdir,
  lstat,
  realpath,
  readdir,
  stat,
  open,
  rename,
  unlink,
  rmdir,
  readFile,
  statfs,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { ApiError } from "../../http/errors";
import type { ContentPaths, MediaVariant } from "../contracts";
import type { ContentEnvironmentLease } from "../environment-lock";
import type { EncodedContentImage } from "./codec";
const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const validId = (id: string) => /^[a-f0-9-]{36}$/.test(id);
const validHash = (hash: string) => /^[a-f0-9]{64}$/.test(hash);
const storageError = () =>
  new ApiError(
    503,
    "CONTENT_STORAGE_FULL",
    "Không đủ dung lượng lưu nội dung, vui lòng kiểm tra lưu trữ",
  );
async function canonical(directory: string) {
  const actual = await realpath(directory),
    expected = resolve(directory);
  if (actual !== expected || (await lstat(directory)).isSymbolicLink())
    throw new ApiError(503, "CONTENT_STORAGE_PATH", "Đường dẫn lưu trữ không hợp lệ");
  return actual;
}
async function size(directory: string): Promise<number> {
  let total = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const file = join(directory, entry.name);
    total += entry.isDirectory() ? await size(file) : (await stat(file)).size;
  }
  return total;
}
async function syncDirectory(directory: string) {
  if (process.platform === "win32") return;
  const file = await open(directory, "r");
  try {
    await file.sync();
  } finally {
    await file.close();
  }
}
export function createContentMediaStore(paths: ContentPaths) {
  if (
    !isAbsolute(paths.root) ||
    resolve(paths.media) !== join(resolve(paths.root), "media") ||
    !paths.managedRoots?.length ||
    paths.managedRoots.some((root) => !isAbsolute(root))
  )
    throw new ApiError(503, "CONTENT_STORAGE_PATH", "Cấu hình lưu trữ không hợp lệ");
  async function ready() {
    await canonical(paths.root);
    await canonical(paths.media);
    if (process.platform !== "win32") {
      for (const directory of [paths.root, paths.media]) {
        const info = await stat(directory);
        if (info.uid !== process.getuid?.() || (info.mode & 0o022) !== 0)
          throw new ApiError(503, "CONTENT_STORAGE_PATH", "Kho nội dung không riêng tư");
      }
    }
  }
  return {
    async write(
      id: string,
      image: EncodedContentImage,
      lease: ContentEnvironmentLease,
    ): Promise<MediaVariant[]> {
      if (!validId(id)) throw new Error("Invalid generated media ID");
      await ready();
      lease.assertActive();
      const total = [
        ...new Map(image.variants.map((variant) => [variant.hash, variant.data.length])).values(),
      ].reduce((a, b) => a + b, 0);
      let managed = 0;
      for (const root of paths.managedRoots) {
        await canonical(root);
        managed += await size(root);
      }
      const available = await statfs(paths.root);
      if (
        (await size(paths.root)) + total > paths.maxContentBytes ||
        managed + total + paths.minHeadroomBytes > paths.maxManagedBytes ||
        Number(available.bavail) * Number(available.bsize) < total + paths.minHeadroomBytes
      )
        throw storageError();
      const stage = join(paths.media, `.staging-${id}`),
        target = join(paths.media, id);
      await mkdir(stage, { mode: 0o700 });
      let moved = false;
      const written: string[] = [];
      try {
        const result: MediaVariant[] = [];
        for (const variant of image.variants) {
          if (!validHash(variant.hash) || digest(variant.data) !== variant.hash)
            throw new Error("Content variant checksum mismatch");
          const name = variant.hash + ".webp",
            file = join(stage, name);
          if (!written.includes(name)) {
            const output = await open(
              file,
              constants.O_WRONLY |
                constants.O_CREAT |
                constants.O_EXCL |
                (process.platform === "win32" ? 0 : constants.O_NOFOLLOW),
              0o600,
            );
            written.push(name);
            try {
              await output.writeFile(variant.data);
              await output.sync();
            } finally {
              await output.close();
            }
          }
          result.push({
            hash: variant.hash,
            file: `${id}/${name}`,
            mime: "image/webp",
            width: variant.width,
            height: variant.height,
            bytes: variant.data.length,
          });
        }
        await syncDirectory(stage);
        lease.assertActive();
        await rename(stage, target);
        moved = true;
        await syncDirectory(paths.media);
        lease.assertActive();
        return result;
      } catch (error) {
        if (!moved) {
          for (const name of written) await unlink(join(stage, name)).catch(() => {});
          await rmdir(stage).catch(() => {});
        }
        if (["ENOSPC", "EDQUOT"].includes((error as NodeJS.ErrnoException).code ?? ""))
          throw storageError();
        throw error;
      }
    },
    async read(id: string, variant: MediaVariant): Promise<Buffer> {
      await ready();
      if (
        !validId(id) ||
        !validHash(variant.hash) ||
        variant.file !== `${id}/${variant.hash}.webp` ||
        variant.mime !== "image/webp"
      )
        throw new ApiError(503, "CONTENT_STORAGE_PATH", "Tham chiếu ảnh không hợp lệ");
      const directory = await canonical(join(paths.media, id)),
        file = join(directory, variant.hash + ".webp");
      const relation = relative(paths.media, directory);
      if (relation.startsWith("..") || isAbsolute(relation) || relation.includes(sep))
        throw new ApiError(503, "CONTENT_STORAGE_PATH", "Tham chiếu ảnh không hợp lệ");
      const info = await lstat(file);
      if (
        !info.isFile() ||
        info.isSymbolicLink() ||
        info.size !== variant.bytes ||
        info.size > 32 * 1024 ** 2
      )
        throw new ApiError(503, "CONTENT_MEDIA_MISSING", "Không đọc được ảnh");
      const bytes = await readFile(file);
      if (digest(bytes) !== variant.hash)
        throw new ApiError(503, "CONTENT_MEDIA_CORRUPT", "Ảnh không toàn vẹn");
      return bytes;
    },
  };
}
