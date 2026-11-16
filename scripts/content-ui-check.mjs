import { run } from "./runtime.mjs";
await run(process.execPath, ["--test", "tests/e2e/content-cms.spec.mjs"]);
