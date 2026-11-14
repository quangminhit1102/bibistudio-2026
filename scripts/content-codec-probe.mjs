import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
export const codecPackages = { sharp: "0.35.5", dompurify: "3.4.17", jsdom: "30.1.3" };
export const codecSource = String.raw`
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const sharp = require("sharp");
const { JSDOM } = require("jsdom");
const createDOMPurify = require("dompurify");
function version(name) {
 let directory = path.dirname(require.resolve(name));
 for (let n=0;n<5;n++,directory=path.dirname(directory)) {
  const filename=path.join(directory,"package.json");
  if(fs.existsSync(filename)) { const pkg=JSON.parse(fs.readFileSync(filename,"utf8")); if(pkg.name===name)return pkg.version; }
 }
 throw Error("Package version not found");
}
(async () => {
 const window = new JSDOM("").window;
 const clean = createDOMPurify(window).sanitize('<p onclick="alert(1)">Safe</p><script>alert(2)</script><img src=x onerror=alert(3)>');
 assert.equal(clean, '<p>Safe</p><img src="x">'); window.close();
 const result = { node:process.version, platform:process.platform, sharp:version("sharp"), dompurify:version("dompurify"), jsdom:version("jsdom"), commonjs:true, jpeg:false, png:false, webp:false, metadataStripped:true, maliciousMarkupRemoved:true, cjsSha256:crypto.createHash("sha256").update(fs.readFileSync(__filename)).digest("hex") };
 for (const format of ["jpeg","png","webp"]) {
  const input = await sharp({create:{width:4,height:3,channels:3,background:{r:210,g:80,b:50}}}).withMetadata({orientation:6}).toFormat(format).toBuffer();
  const original = await sharp(input).metadata(); assert.equal(original.format,format);
  assert.equal(original.orientation,6);
  const output = await sharp(input,{limitInputPixels:16000000}).rotate().resize({width:2400,height:2400,fit:"inside",withoutEnlargement:true}).webp({quality:80}).toBuffer();
  const metadata = await sharp(output).metadata();
  assert.equal(metadata.width,3); assert.equal(metadata.height,4);
  assert.equal(metadata.format,"webp"); assert.equal(metadata.exif,undefined); assert.equal(metadata.icc,undefined);
  result[format]=true;
 }
 console.log(JSON.stringify(result));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
`;

export async function runCodecProbe() {
  if (Number(process.versions.node.split(".")[0]) !== 24)
    throw new Error("Codec proof requires Node 24");
  const directory = path.join(root, ".superpowers/sdd/2026-11-14-content-cms-seo/codec");
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, "package.json"),
    JSON.stringify({ private: true, dependencies: codecPackages }),
  );
  const execute = (command, args) => {
    const result = spawnSync(command, args, {
      cwd: directory,
      encoding: "utf8",
      windowsHide: true,
      timeout: 180000,
    });
    if (result.status !== 0)
      throw new Error(
        (result.stderr || result.stdout || result.error?.message || "Codec command failed").slice(
          -3000,
        ),
      );
    return result.stdout;
  };
  try {
    await readFile(path.join(directory, "node_modules/sharp/package.json"));
  } catch {
    const npm =
      process.env.npm_execpath ||
      (process.platform === "win32"
        ? "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js"
        : path.join(path.dirname(process.execPath), "../lib/node_modules/npm/bin/npm-cli.js"));
    execute(process.execPath, [
      npm,
      "install",
      "--no-audit",
      "--no-fund",
      "--registry=https://registry.npmjs.org",
    ]);
  }
  await writeFile(path.join(directory, "probe.cts"), codecSource);
  execute(process.execPath, [
    path.join(root, "node_modules/typescript/bin/tsc"),
    "probe.cts",
    "--module",
    "nodenext",
    "--target",
    "es2023",
    "--outDir",
    "compiled",
    "--types",
    "node",
    "--typeRoots",
    path.join(root, "node_modules/@types"),
    "--skipLibCheck",
  ]);
  const filename = path.join(directory, "compiled/probe.cjs");
  const result = JSON.parse(execute(process.execPath, [filename]));
  const digest = createHash("sha256")
    .update(await readFile(filename))
    .digest("hex");
  if (result.cjsSha256 !== digest) throw new Error("Compiled codec proof checksum mismatch");
  await writeFile(path.join(directory, "local-receipt.json"), JSON.stringify(result, null, 2));
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runCodecProbe()
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
