import test from "node:test";
import { resolve } from "node:path";
import { verifyContentBundle } from "../../scripts/content-bundle-check.mjs";
test(
  "actual compiled artifact satisfies its own CMS or bridge capability",
  { timeout: 300000 },
  async () => {
    if (!process.env.BIBI_CONTENT_BUNDLE || !process.env.BIBI_CONTENT_MODE)
      throw Error("Explicit built content artifact and actual mode required");
    await verifyContentBundle({
      bundleDir: resolve(process.env.BIBI_CONTENT_BUNDLE),
      mode: process.env.BIBI_CONTENT_MODE,
      evidenceDir: resolve(
        process.env.BIBI_CONTENT_EVIDENCE ?? ".superpowers/e2e/content-compiled",
      ),
    });
  },
);
