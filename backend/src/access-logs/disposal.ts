import { lstat, readdir, rename, rmdir, unlink } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { AccessLogFailure } from "./sources";

const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === "ENOENT";
async function clean(folder: string, payload: string): Promise<void> {
  const info = await lstat(folder).catch((error) => {
    if (!missing(error)) throw error;
    return undefined;
  });
  if (!info) return;
  if (!info.isDirectory() || info.isSymbolicLink()) throw new AccessLogFailure("UNSAFE_WORK_ENTRY");
  const files = await readdir(folder);
  // Validate everything before deleting anything; never follow a link or sweep unknown files.
  for (const name of files) {
    if (![payload, "descriptor.json"].includes(name))
      throw new AccessLogFailure("UNEXPECTED_WORK_ENTRY");
    const entry = await lstat(join(folder, name));
    if (!entry.isFile() || entry.isSymbolicLink()) throw new AccessLogFailure("UNSAFE_WORK_ENTRY");
  }
  for (const name of files)
    await unlink(join(folder, name)).catch((error) => {
      if (!missing(error)) throw error;
    });
  await rmdir(folder).catch((error) => {
    if (!missing(error)) throw error;
  });
}

/** Called only by the importer under its job lock. Live queue entries remain strict. */
export async function recoverDisposals(
  root: string,
  liveName: RegExp,
  payload: string,
): Promise<void> {
  for (const name of await readdir(root)) {
    if (!name.startsWith(".disposing-")) continue;
    if (!liveName.test(name.slice(".disposing-".length)))
      throw new AccessLogFailure("UNEXPECTED_WORK_ENTRY");
    await clean(join(root, name), payload);
  }
}

export async function disposeSnapshot(folder: string, payload: string): Promise<void> {
  const retired = join(dirname(folder), ".disposing-" + basename(folder));
  await clean(retired, payload);
  await rename(folder, retired).catch((error) => {
    if (!missing(error)) throw error;
  });
  await clean(retired, payload);
}
