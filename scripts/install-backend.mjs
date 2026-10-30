import { root, runNpm } from "./runtime.mjs";
import { join } from "node:path";
if (Number(process.versions.node.split(".")[0]) !== 24) {
  console.error(
    `BiBi Studio requires Node 24. Current: ${process.version}. Select Node 24 and run npm ci again.`,
  );
  process.exitCode = 1;
} else {
  await runNpm(["ci", "--no-audit", "--no-fund"], join(root, "backend"));
  await runNpm(["ci", "--ignore-scripts", "--no-audit", "--no-fund"], join(root, "ops"));
}
