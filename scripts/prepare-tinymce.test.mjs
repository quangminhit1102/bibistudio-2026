import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { prepareTinyMce } from "./prepare-tinymce.mjs";
test("prepares only local runtime, selected plugins, translation and license notices", async () => {
  const root = await mkdtemp(join(tmpdir(), "bibi-tiny-"));
  try {
    const files = [
      "package.json",
      "tinymce.min.js",
      "license.md",
      "notices.txt",
      "icons/default/icons.min.js",
      "themes/silver/theme.min.js",
      "models/dom/model.min.js",
      "skins/ui/oxide/skin.min.css",
      "skins/ui/oxide/content.min.css",
      "skins/ui/oxide-dark/skin.min.css",
      "skins/ui/oxide-dark/content.min.css",
      "skins/content/default/content.min.css",
      "skins/content/dark/content.min.css",
      "skins/ui/oxide/skin.css",
      "plugins/lists/plugin.min.js",
      "plugins/link/plugin.min.js",
      "plugins/wordcount/plugin.min.js",
      "plugins/table/plugin.min.js",
      "plugins/searchreplace/plugin.min.js",
      "plugins/charmap/plugin.min.js",
      "plugins/fullscreen/plugin.min.js",
      "plugins/advlist/plugin.min.js",
      "plugins/autolink/plugin.min.js",
      "plugins/visualblocks/plugin.min.js",
    ];
    for (const f of files) {
      const p = join(root, "node_modules/tinymce", f);
      await mkdir(dirname(p), { recursive: true });
      await writeFile(p, f === "package.json" ? '{"version":"8.10.1"}' : "fixture-" + f);
    }
    for (const f of ["langs8/vi.js", "LICENSE.md"]) {
      const p = join(root, "node_modules/tinymce-i18n", f);
      await mkdir(dirname(p), { recursive: true });
      await writeFile(p, "translation-" + f);
    }
    const target = await prepareTinyMce(root);
    assert.equal(await readFile(join(target, "tinymce.min.js"), "utf8"), "fixture-tinymce.min.js");
    assert.equal(
      await readFile(join(target, "plugins/table/plugin.min.js"), "utf8"),
      "fixture-plugins/table/plugin.min.js",
    );
    assert.equal(await readFile(join(target, "license.md"), "utf8"), "fixture-license.md");
    assert.equal(await readFile(join(target, "langs/vi.js"), "utf8"), "translation-langs8/vi.js");
    await assert.rejects(readFile(join(target, "plugins/ai/plugin.min.js")));
    await assert.rejects(readFile(join(target, "skins/ui/oxide/skin.css")));
    assert.equal(
      JSON.parse(await readFile(join(target, "source.json"), "utf8")).license,
      "GPL-2.0-or-later",
    );
    await prepareTinyMce(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
