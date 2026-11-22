import { constants, lstatSync, realpathSync, type Stats } from "node:fs";
import { open, lstat, unlink, rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { isAbsolute, resolve, join } from "node:path";
import { ApiError } from "../http/errors";

export interface StoredMedia {
  id: string;
  path: string;
}

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const unavailable = () =>
  new ApiError(503, "MEDIA_UNAVAILABLE", "Không đọc hoặc lưu được tệp phương tiện lúc này");

export function createMediaStore({ root }: { root: string }) {
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
    throw new Error("Unsafe private media directory");
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
    throw new Error("Unsafe private media alias");
  function checkRoot() {
    const current = lstatSync(directory);
    safe(current, true);
    if (current.ino !== initial.ino || current.dev !== initial.dev) throw unavailable();
  }
  function path(id: string) {
    if (!uuid.test(id)) throw unavailable();
    return join(directory, id);
  }
  return {
    async save(bytes: Buffer, mime: string, width: number, height: number): Promise<StoredMedia> {
      checkRoot();
      if (
        !Buffer.isBuffer(bytes) ||
        !bytes.length ||
        bytes.length > 2097152 ||
        !["image/jpeg", "image/png"].includes(mime) ||
        width < 1 ||
        height < 1
      )
        throw unavailable();
      const id = randomUUID(),
        destination = path(id),
        pending = join(directory, ".pending-" + id);
      let reserved = false;
      try {
        const file = await open(
          pending,
          constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0),
          0o600,
        );
        try {
          await file.writeFile(bytes);
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
        return { id, path: destination };
      } catch {
        if (reserved) await unlink(destination).catch(() => {});
        throw unavailable();
      } finally {
        await unlink(pending).catch(() => {});
      }
    },
    async read(id: string): Promise<Buffer> {
      try {
        checkRoot();
        const name = path(id),
          before = await lstat(name);
        safe(before);
        if (before.size < 1 || before.size > 2097152) throw unavailable();
        const file = await open(name, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
        try {
          checkRoot();
          const opened = await file.stat();
          safe(opened);
          if (opened.ino !== before.ino || opened.dev !== before.dev) throw unavailable();
          const size = before.size,
            data = Buffer.alloc(size + 1);
          let got = 0;
          while (got < data.length) {
            const read = await file.read(data, got, data.length - got, got);
            if (!read.bytesRead) break;
            got += read.bytesRead;
          }
          if (got !== size || (await file.stat()).size !== size) throw unavailable();
          return data.subarray(0, got);
        } finally {
          await file.close();
        }
      } catch {
        throw unavailable();
      }
    },
    async remove(id: string): Promise<void> {
      checkRoot();
      const name = path(id);
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
export type MediaStore = ReturnType<typeof createMediaStore>;
