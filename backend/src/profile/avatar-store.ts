import { constants, lstatSync, realpathSync, type Stats } from "node:fs";
import { open, lstat, unlink, rename } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import { isAbsolute, resolve, join } from "node:path";
import { ApiError } from "../http/errors";
import type { NormalizedAvatar } from "./avatar-codec";
export interface StoredAvatar {
  id: string;
  format: "jpeg" | "png";
  width: number;
  height: number;
  byteLength: number;
  sha256: string;
}
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const unavailable = () =>
  new ApiError(503, "AVATAR_UNAVAILABLE", "Không đọc hoặc lưu được ảnh đại diện lúc này");
export function createAvatarStore({ root }: { root: string }) {
  if (
    !isAbsolute(root) ||
    resolve(root)
      .split(/[\\/]/)
      .some((p) =>
        [
          "public",
          "public_html",
          "frontend",
          "dist-cpanel",
          "dist",
          ".releases",
          "releases",
          "node_modules",
          ".git",
        ].includes(p.toLowerCase()),
      )
  )
    throw new Error("Unsafe private avatar directory");
  const directory = resolve(root),
    initial = lstatSync(directory);
  const owner = typeof process.getuid === "function" ? process.getuid() : undefined;
  function safe(stat: Stats, isDirectory = false) {
    if (
      stat.isSymbolicLink() ||
      !(isDirectory ? stat.isDirectory() : stat.isFile()) ||
      (owner !== undefined && (stat.uid !== owner || (stat.mode & 0o077) !== 0))
    )
      throw unavailable();
  }
  safe(initial, true);
  if (
    (process.platform === "win32"
      ? realpathSync(directory).toLowerCase()
      : realpathSync(directory)) !==
    (process.platform === "win32" ? directory.toLowerCase() : directory)
  )
    throw new Error("Unsafe private avatar alias");
  function checkRoot() {
    const current = lstatSync(directory);
    safe(current, true);
    if (current.ino !== initial.ino || current.dev !== initial.dev) throw unavailable();
  }
  function path(id: string, format: string) {
    if (!uuid.test(id) || !["jpeg", "png"].includes(format)) throw unavailable();
    return join(directory, id + "." + format);
  }
  return {
    async write(image: NormalizedAvatar): Promise<StoredAvatar> {
      checkRoot();
      if (
        !Buffer.isBuffer(image.bytes) ||
        !image.bytes.length ||
        image.bytes.length > 2097152 ||
        image.width < 1 ||
        image.height < 1 ||
        image.width > 512 ||
        image.height > 512
      )
        throw unavailable();
      const id = randomUUID(),
        destination = path(id, image.format),
        pending = join(directory, ".pending-" + id);
      let reserved = false;
      try {
        const file = await open(
          pending,
          constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0),
          0o600,
        );
        try {
          await file.writeFile(image.bytes);
          await file.sync();
        } finally {
          await file.close();
        }
        checkRoot();
        const reservation = await open(destination, "wx", 0o600);
        reserved = true;
        await reservation.close();
        await rename(pending, destination);
        if (process.platform !== "win32") {
          const dir = await open(directory, "r");
          try {
            await dir.sync();
          } finally {
            await dir.close();
          }
        }
        return {
          id,
          format: image.format,
          width: image.width,
          height: image.height,
          byteLength: image.bytes.length,
          sha256: createHash("sha256").update(image.bytes).digest("hex"),
        };
      } catch {
        if (reserved) await unlink(destination).catch(() => {});
        throw unavailable();
      } finally {
        await unlink(pending).catch(() => {});
      }
    },
    async read(asset: StoredAvatar): Promise<Buffer> {
      try {
        checkRoot();
        const name = path(asset.id, asset.format),
          before = await lstat(name);
        safe(before);
        if (asset.byteLength < 1 || asset.byteLength > 2097152 || before.size !== asset.byteLength)
          throw unavailable();
        const file = await open(name, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
        try {
          checkRoot();
          const opened = await file.stat();
          safe(opened);
          if (opened.ino !== before.ino || opened.dev !== before.dev) throw unavailable();
          const data = Buffer.alloc(asset.byteLength + 1);
          let size = 0;
          while (size < data.length) {
            const read = await file.read(data, size, data.length - size, size);
            if (!read.bytesRead) break;
            size += read.bytesRead;
          }
          if (size !== asset.byteLength || (await file.stat()).size !== asset.byteLength)
            throw unavailable();
          const bytes = data.subarray(0, size);
          if (createHash("sha256").update(bytes).digest("hex") !== asset.sha256)
            throw unavailable();
          return bytes;
        } finally {
          await file.close();
        }
      } catch {
        throw unavailable();
      }
    },
    async remove(id: string, format: "jpeg" | "png"): Promise<void> {
      checkRoot();
      const name = path(id, format);
      try {
        safe(await lstat(name));
        await unlink(name);
      } catch (error) {
        if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT"))
          throw unavailable();
      }
    },
  };
}
export type AvatarStore = ReturnType<typeof createAvatarStore>;
