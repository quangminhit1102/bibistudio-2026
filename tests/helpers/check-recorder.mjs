import { registerHooks } from "node:module";
const modules = {
  "./runtime.mjs": `import {appendFileSync} from 'node:fs';export const root=process.cwd();export async function run(command,args,options){appendFileSync(process.env.BIBI_CHECK_RECORD_FILE,JSON.stringify({command,args,options})+'\\n');}`,
  "./test-database.mjs": "export async function ensureTestDatabase() {}",
  "./prepare-geoip.mjs": "export async function prepareCountryDataset() {}",
};
registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.endsWith("/scripts/check.mjs") && Object.hasOwn(modules, specifier))
      return { url: "bibi-check:" + specifier, shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith("bibi-check:"))
      return { format: "module", source: modules[url.slice(11)], shortCircuit: true };
    return next(url, context);
  },
});
