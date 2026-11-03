import tinyPackage from "tinymce/package.json";
export const tinyAssetBase = `${import.meta.env.BASE_URL}vendor/tinymce-${tinyPackage.version}/`;

export interface TinyAssetRegistry {
  PluginManager: { get: (name: string) => unknown; remove: (name: string) => void };
  ThemeManager: { get: (name: string) => unknown; remove: (name: string) => void };
  ModelManager: { get: (name: string) => unknown; remove: (name: string) => void };
  ScriptLoader: { remove: (url: string) => void };
  baseURI: { toAbsolute: (path: string) => string };
}
export function resetFailedTinyAssets(tiny: TinyAssetRegistry): void {
  const reset = (manager: TinyAssetRegistry["PluginManager"], name: string, path: string) => {
    if (!manager.get(name)) {
      manager.remove(name);
      tiny.ScriptLoader.remove(tiny.baseURI.toAbsolute(path));
    }
  };
  for (const plugin of ["lists", "link", "wordcount"])
    reset(tiny.PluginManager, plugin, `plugins/${plugin}/plugin.min.js`);
  reset(tiny.ThemeManager, "silver", "themes/silver/theme.min.js");
  reset(tiny.ModelManager, "dom", "models/dom/model.min.js");
  tiny.ScriptLoader.remove(`${tinyAssetBase}langs/vi.js`);
  tiny.ScriptLoader.remove(tiny.baseURI.toAbsolute(`${tinyAssetBase}langs/vi.js`));
  tiny.ScriptLoader.remove(tiny.baseURI.toAbsolute("icons/default/icons.min.js"));
}
