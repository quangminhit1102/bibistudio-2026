import { cp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { join, dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export async function prepareTinyMce(
  rootDir = join(dirname(fileURLToPath(import.meta.url)), ".."),
) {
  const source = join(rootDir, "node_modules/tinymce");
  const { version } = JSON.parse(await readFile(join(source, "package.json"), "utf8"));
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error("Invalid TinyMCE version");
  const vendorRoot = resolve(rootDir, "public", "vendor");
  const target = resolve(vendorRoot, `tinymce-${version}`);
  if (!target.startsWith(vendorRoot + sep)) throw new Error("Invalid vendor target");
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  const files = [
    "tinymce.min.js",
    "license.md",
    "notices.txt",
    "icons/default/icons.min.js",
    "themes/silver/theme.min.js",
    "models/dom/model.min.js",
    ...[
      "lists",
      "link",
      "wordcount",
      "table",
      "searchreplace",
      "charmap",
      "fullscreen",
      "advlist",
      "autolink",
      "visualblocks",
    ].map((p) => `plugins/${p}/plugin.min.js`),
    ...["oxide", "oxide-dark"].flatMap((skin) =>
      ["skin.min.css", "content.min.css"].map((file) => `skins/ui/${skin}/${file}`),
    ),
    ...["default", "dark"].map((skin) => `skins/content/${skin}/content.min.css`),
  ];
  for (const file of files) {
    await mkdir(dirname(join(target, file)), { recursive: true });
    await cp(join(source, file), join(target, file));
  }
  await mkdir(join(target, "langs"), { recursive: true });
  await cp(join(rootDir, "node_modules/tinymce-i18n/langs8/vi.js"), join(target, "langs/vi.js"));
  await cp(join(rootDir, "node_modules/tinymce-i18n/LICENSE.md"), join(target, "langs/LICENSE.md"));
  await writeFile(
    join(target, "source.json"),
    JSON.stringify({
      version,
      source: `https://github.com/tinymce/tinymce/tree/${version}`,
      license: "GPL-2.0-or-later",
    }),
  );
  return target;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]))
  console.log("TinyMCE local assets:", await prepareTinyMce());
