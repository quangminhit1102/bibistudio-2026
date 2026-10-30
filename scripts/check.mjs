import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { root, run } from "./runtime.mjs";
const node = (file, args = [], options = {}) => run(process.execPath, [file, ...args], options);
try {
  await node("node_modules/typescript/bin/tsc", ["--noEmit"]);
  await node("backend/node_modules/typescript/bin/tsc", ["-p", "backend/tsconfig.build.json"]);
  console.log(
    "Lint scope: backend/src, new tooling, API client/page. Existing catalogue UI is not reformatted.",
  );
  await node("node_modules/eslint/bin/eslint.js", [
    "backend/src",
    "src/lib/api-demo.ts",
    "src/routes/api-test.tsx",
    "vite.local.config.ts",
    "ops",
    "scripts",
    "--no-warn-ignored",
  ]);
  await node("scripts/catalogue-images.mjs");
  const scripts = (await readdir(join(root, "scripts")))
    .filter((n) => n.endsWith(".test.mjs"))
    .map((n) => `scripts/${n}`);
  const backend = (await readdir(join(root, "backend/test")))
    .filter((n) => n.endsWith(".test.mjs"))
    .map((n) => `backend/test/${n}`);
  await run(process.execPath, ["--test", ...scripts, ...backend, "src/lib/api-demo.test.ts"]);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
