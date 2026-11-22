import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { root } from "./runtime.mjs";
import { findBoundaryViolations, phaseOneBoundary } from "./site-boundary.mjs";
import { loadSiteConfig } from "./site-html.mjs";

const site = {
  name: "BiBi Studio",
  shortName: "BiBi",
  url: "https://bibistudio.vn",
  contact: { phone: "0392969000", email: "bibistudio@gmail.com" },
};

async function tree(files) {
  const dir = await mkdtemp(join(tmpdir(), "site-boundary-"));
  for (const [file, body] of Object.entries(files)) {
    await mkdir(dirname(join(dir, file)), { recursive: true });
    await writeFile(join(dir, file), body);
  }
  return dir;
}

async function violations(files, options = {}) {
  const dir = await tree(files);
  try {
    return await findBoundaryViolations({
      root: dir,
      site,
      checkedDirs: ["src/lib", "src/platform"],
      ...options,
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("reports a brand string in a core file with its file and line", async () => {
  const found = await violations({
    "src/lib/x.ts": 'const a = 1;\nexport const title = "BiBi Studio";\n',
  });
  assert.equal(found.length, 1);
  assert.equal(found[0].file, "src/lib/x.ts");
  assert.equal(found[0].line, 2);
  assert.match(found[0].reason, /BiBi Studio/);
});

test("reports the site domain, phone and email", async () => {
  const found = await violations({
    "src/lib/x.ts": [
      'const a = "https://bibistudio.vn/x";',
      'const b = "tel:0392969000";',
      'const c = "bibistudio@gmail.com";',
    ].join("\n"),
  });
  assert.deepEqual(
    found.map((v) => v.line),
    [1, 2, 3],
  );
});

test("allows @site imports only in the platform entry point", async () => {
  const found = await violations({
    "src/lib/y.ts": 'import x from "@site/site.config";\n',
    "src/lib/z.css": '@import "@site/theme.css";\n',
    "src/platform/site.ts": 'import x from "@site/site.config";\nexport const site = x;\n',
  });
  assert.deepEqual(
    found.map((v) => v.file),
    ["src/lib/y.ts", "src/lib/z.css"],
  );
  assert.match(found[0].reason, /@site/);
});

test("reports a relative path into the site folder", async () => {
  const found = await violations({
    "src/lib/x.css": '@source "../../site";\n',
    "src/lib/y.ts": 'import logo from "../../site/assets/logo";\n',
    "src/lib/z.ts": 'import { helper } from "../site-contact";\n',
  });
  assert.deepEqual(
    found.map((v) => v.file),
    ["src/lib/x.css", "src/lib/y.ts"],
  );
  assert.match(found[0].reason, /SITE_DIR/);
});

test("ignores allowed internal identifiers", async () => {
  const found = await violations(
    {
      "src/lib/x.ts": 'headers.set("X-Bibi-Request", "1");\nconst k = "bibi-admin:session";\n',
    },
    { allow: ["X-Bibi-Request", "bibi-admin"] },
  );
  assert.deepEqual(found, []);
});

test("skips excluded paths and files outside the checked folders", async () => {
  const found = await violations(
    {
      "src/lib/seed.ts": 'export const a = "BiBi Studio";\n',
      "src/lib/x.test.ts": 'export const a = "BiBi Studio";\n',
      "src/data/x.ts": 'export const a = "BiBi Studio";\n',
    },
    { exclude: [/(^|\/)seed\.ts$/, /\.test\./] },
  );
  assert.deepEqual(found, []);
});

test("the repository keeps site-specific values out of migrated core folders", async () => {
  const found = await findBoundaryViolations({
    root,
    site: await loadSiteConfig(join(root, process.env.SITE_DIR ?? "site")),
    ...phaseOneBoundary,
  });
  assert.deepEqual(found, []);
});
