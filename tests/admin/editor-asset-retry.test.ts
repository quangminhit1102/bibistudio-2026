import { expect, it } from "vitest";
import {
  resetFailedTinyAssets,
  tinyAssetBase,
} from "../../src/features/admin/content/components/tiny-config";
it("clears failed addon and script cache entries without removing loaded plugins", () => {
  const pending = new Set(["lists", "silver", "dom"]),
    loaded = new Set(["link", "wordcount"]);
  const manager = {
    get: (name: string) => (loaded.has(name) ? {} : undefined),
    remove: (name: string) => {
      pending.delete(name);
    },
  };
  const scripts = new Set([
    "https://local.test/plugins/lists/plugin.min.js",
    tinyAssetBase + "langs/vi.js",
  ]);
  resetFailedTinyAssets({
    PluginManager: manager,
    ThemeManager: manager,
    ModelManager: manager,
    ScriptLoader: {
      remove: (url) => {
        scripts.delete(url);
      },
    },
    baseURI: { toAbsolute: (path) => "https://local.test/" + path },
  });
  expect(pending.size).toBe(0);
  expect(scripts.size).toBe(0);
  expect([...loaded]).toEqual(["link", "wordcount"]);
});
