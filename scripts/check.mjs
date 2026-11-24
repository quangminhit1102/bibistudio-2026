import { join } from "node:path";
import { readdir, readFile } from "node:fs/promises";
import { root, run, isMain } from "./runtime.mjs";
import { ensureTestDatabase } from "./test-database.mjs";
import { prepareCountryDataset } from "./prepare-geoip.mjs";
import { loadSiteConfig } from "./site-html.mjs";

export const STAGES = ["static", "admin", "blank-site", "backend", "e2e"];
/** The smallest site core accepts; building it proves core does not need the default site. */
export const BLANK_SITE = "tests/fixtures/site-blank";
export const E2E_SUITES = [
  "auth",
  "visitor-analytics",
  "admin-usability",
  "profile",
  "visitor-relay",
];

/** `check.mjs` runs everything; `check.mjs <stage>` one stage; `check.mjs e2e <suite>` one browser suite. */
export function selectStages(args) {
  const [stage, suite, ...rest] = args;
  if (
    rest.length ||
    (stage !== undefined && !STAGES.includes(stage)) ||
    (suite !== undefined && (stage !== "e2e" || !E2E_SUITES.includes(suite)))
  )
    throw new Error(
      `Usage: check.mjs [${STAGES.join("|")}] — e2e accepts one of: ${E2E_SUITES.join(", ")}`,
    );
  return { stages: stage ? [stage] : STAGES, suites: suite ? [suite] : E2E_SUITES };
}

const node = (file, args = [], options = {}) => run(process.execPath, [file, ...args], options);
const once = (task) => {
  let done;
  return () => (done ??= task());
};
const countryDataset = once(prepareCountryDataset);
const backendBuild = once(() =>
  node("backend/node_modules/typescript/bin/tsc", ["-p", "backend/tsconfig.build.json"]),
);
const testDatabase = once(ensureTestDatabase);

/** A build must carry the values of the site it was built for. */
export async function assertSiteBuild(dir, site) {
  const html = await readFile(join(dir, "index.html"), "utf8");
  if (!html.includes(`<title>${site.name}</title>`))
    throw new Error(`Built index.html does not carry the site name "${site.name}"`);
  const scripts = (await readdir(join(dir, "assets"))).filter((name) => name.endsWith(".js"));
  for (const name of scripts)
    if ((await readFile(join(dir, "assets", name), "utf8")).includes(site.admin.title)) return;
  throw new Error(`No built script carries the admin title "${site.admin.title}"`);
}

const stageRunners = {
  async static() {
    await countryDataset();
    await node("node_modules/typescript/bin/tsc", ["--noEmit"]);
    await backendBuild();
    console.log(
      "Lint scope: backend/src, new tooling, API client/page. Existing catalogue UI is not reformatted.",
    );
    await node("node_modules/eslint/bin/eslint.js", [
      "src/features/admin",
      "src/lib/admin-boundary.ts",
      "src/lib/admin-http.ts",
      "src/lib/route-leaf.tsx",
      "src/routes/admin*.tsx",
      "backend/src",
      "src/lib/api-demo.ts",
      "src/routes/api-test.tsx",
      "vite.local.config.ts",
      "ops",
      "scripts",
      "--no-warn-ignored",
    ]);
    await node("scripts/catalogue-images.mjs");
  },
  async admin() {
    await node("node_modules/vitest/vitest.mjs", ["run", "--config", "vitest.admin.config.ts"]);
  },
  async "blank-site"() {
    const env = { ...process.env, SITE_DIR: BLANK_SITE };
    const outDir = ".superpowers/site-blank";
    await node("node_modules/typescript/bin/tsc", [
      "--noEmit",
      "-p",
      `${BLANK_SITE}/tsconfig.json`,
    ]);
    await node("node_modules/vitest/vitest.mjs", ["run", "--config", "vitest.admin.config.ts"], {
      env,
    });
    await node(
      "node_modules/vite/bin/vite.js",
      ["build", "--config", "vite.cpanel.config.ts", "--outDir", outDir],
      { env },
    );
    await assertSiteBuild(join(root, outDir), await loadSiteConfig(join(root, BLANK_SITE)));
  },
  async backend() {
    await countryDataset();
    await backendBuild();
    const scripts = (await readdir(join(root, "scripts")))
      .filter((n) => n.endsWith(".test.mjs") && !["dev.test.mjs", "dev-relay.test.mjs"].includes(n))
      .map((n) => `scripts/${n}`);
    const backend = (await readdir(join(root, "backend/test")))
      .filter((n) => n.endsWith(".test.mjs"))
      .map((n) => `backend/test/${n}`);
    await testDatabase();
    await run(process.execPath, ["--test", ...scripts, ...backend, "src/lib/api-demo.test.ts"]);
    await run(process.execPath, ["--test", "scripts/dev.test.mjs"]);
    await run(process.execPath, ["--test", "scripts/dev-relay.test.mjs"]);
  },
  async e2e(suites) {
    await countryDataset();
    await backendBuild();
    await testDatabase();
    for (const suite of suites)
      await run(process.execPath, ["--test", `tests/e2e/${suite}.spec.mjs`]);
  },
};

if (isMain(import.meta.url)) {
  try {
    const { stages, suites } = selectStages(process.argv.slice(2));
    for (const stage of stages) await stageRunners[stage](suites);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
