import { run } from "./runtime.mjs";
await run(process.execPath, ["--test", "tests/e2e/auth.spec.mjs"]);
await run(process.execPath, ["--test", "tests/e2e/visitor-analytics.spec.mjs"]);

await run(process.execPath, ["--test", "tests/e2e/admin-usability.spec.mjs"]);

await run(process.execPath, ["--test", "tests/e2e/profile.spec.mjs"]);
