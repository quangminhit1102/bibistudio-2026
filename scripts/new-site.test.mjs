import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { root } from "./runtime.mjs";
import { createSite } from "./new-site.mjs";
import { loadSiteConfig } from "./site-html.mjs";

test("a site created from the blank one loads from its new folder", async () => {
  const folder = `.superpowers/new-site-test-${process.pid}/deep/site`;
  try {
    const target = await createSite(folder);
    assert.equal((await loadSiteConfig(target)).name, "Northwind Studio");
    const tsconfig = JSON.parse(await readFile(join(target, "tsconfig.json"), "utf8"));
    assert.equal(tsconfig.extends, "../../../../tsconfig.json");
    assert.deepEqual(tsconfig.compilerOptions.paths["@/*"], ["../../../../src/*"]);
    assert.match(
      await readFile(join(target, "messages/vi.ts"), "utf8"),
      /from "\.\.\/site\.config\.ts"/,
    );
    await assert.rejects(createSite(folder), /already exists/);
  } finally {
    await rm(join(root, `.superpowers/new-site-test-${process.pid}`), {
      recursive: true,
      force: true,
    });
  }
});
test("the default site folder is refused while it exists, and a folder outside the repository always", async () => {
  await stat(join(root, "site"));
  await assert.rejects(createSite(), /already exists/);
  await assert.rejects(createSite("../elsewhere"), /inside the repository/);
});
