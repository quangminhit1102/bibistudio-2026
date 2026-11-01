import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { gzipSync } from "node:zlib";
const baseline = resolve(
  process.argv[2] ?? ".superpowers/sdd/2026-11-01-admin-dashboard/baseline/assets",
);
const current = resolve(process.argv[3] ?? "dist-cpanel/assets");
async function measure(dir) {
  const files = await readdir(dir);
  const entry = files.find((f) => /^cpanel-.*\.js$/.test(f));
  const css = files.find((f) => /^styles-.*\.css$/.test(f));
  if (!entry || !css) throw new Error(`Missing public entry in ${dir}`);
  const js = await readFile(join(dir, entry));
  const style = await readFile(join(dir, css));
  const visited = new Set();
  async function walk(file) {
    if (visited.has(file)) return 0;
    visited.add(file);
    const source = await readFile(join(dir, file), "utf8");
    let total = gzipSync(source).length;
    const imports = [
      ...source.matchAll(
        /\b(?:import|export)\s*(?:[^"'();]*?\s*from\s*)?["']\.\/([^"']+\.js)["']/g,
      ),
    ];
    for (const match of imports) total += await walk(match[1]);
    return total;
  }
  const initialGzip = await walk(entry);
  return {
    entry,
    css,
    jsBytes: js.length,
    jsGzip: gzipSync(js).length,
    cssBytes: style.length,
    cssGzip: gzipSync(style).length,
    initialGzip,
    initialFiles: [...visited],
  };
}
const before = await measure(baseline),
  after = await measure(current);
const report = {
  before,
  after,
  delta: {
    jsGzip: after.initialGzip - before.initialGzip,
    cssGzip: after.cssGzip - before.cssGzip,
  },
  limits: { jsGzip: 10240, cssGzip: 2048 },
};
console.log(JSON.stringify(report, null, 2));
const manifest = JSON.parse(await readFile(resolve(current, "../.vite/manifest.json"), "utf8"));
const closure = new Set();
function visit(key) {
  if (closure.has(key)) return;
  closure.add(key);
  for (const imp of manifest[key]?.imports ?? []) visit(imp);
}
visit("cpanel.html");
if ([...closure].some((key) => key.includes("features/admin")))
  throw new Error("Admin code leaked into the public initial manifest graph.");
const manifestFiles = [...closure]
  .map((key) => manifest[key]?.file)
  .filter((f) => f?.endsWith(".js"))
  .map((f) => f.replace(/^assets\//, ""));
if (manifestFiles.some((f) => !after.initialFiles.includes(f)))
  throw new Error("Static import parser missed a manifest dependency.");
if (report.delta.jsGzip > 10240 || report.delta.cssGzip > 2048) process.exitCode = 1;
