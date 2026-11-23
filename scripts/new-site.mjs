// Starts a site from the blank one: `node scripts/new-site.mjs [folder]` (default `site`).
import { cp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { root, isMain } from "./runtime.mjs";
import { BLANK_SITE } from "./check.mjs";

const files = async (dir) =>
  (await readdir(dir, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));

export async function createSite(folder = "site") {
  const source = join(root, BLANK_SITE);
  const target = resolve(root, folder);
  if (!target.startsWith(root + sep))
    throw new Error("A site folder must be inside the repository: it imports the site contract");
  if (await readdir(target).catch(() => null))
    throw new Error(`${folder} already exists; remove it first`);
  await cp(source, target, { recursive: true });
  // The root tsconfig.json already type-checks `site/`.
  if (target === join(root, "site")) await rm(join(target, "tsconfig.json"));
  for (const file of await files(target)) {
    const from = dirname(join(source, relative(target, file)));
    const text = await readFile(file, "utf8");
    // A relative path that climbed to the repository root climbs from the new folder instead.
    const moved = text.replace(/(["'])((?:\.\.\/)+)/g, (match, quote, up) =>
      resolve(from, up) === root
        ? `${quote}${relative(dirname(file), root).split(sep).join("/")}/`
        : match,
    );
    if (moved !== text) await writeFile(file, moved);
  }
  return target;
}

if (isMain(import.meta.url)) {
  try {
    const target = await createSite(process.argv[2]);
    console.log(`Site created in ${relative(root, target)}. Next steps: docs/new-site.md`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
