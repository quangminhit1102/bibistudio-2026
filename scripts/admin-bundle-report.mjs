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
  return {
    entry,
    css,
    jsBytes: js.length,
    jsGzip: gzipSync(js).length,
    cssBytes: style.length,
    cssGzip: gzipSync(style).length,
  };
}
const before = await measure(baseline),
  after = await measure(current);
const report = {
  before,
  after,
  delta: { jsGzip: after.jsGzip - before.jsGzip, cssGzip: after.cssGzip - before.cssGzip },
  limits: { jsGzip: 10240, cssGzip: 2048 },
};
console.log(JSON.stringify(report, null, 2));
if (report.delta.jsGzip > 10240 || report.delta.cssGzip > 2048) process.exitCode = 1;
