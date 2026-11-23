import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { loadSiteConfig, renderSiteHtml } from "./site-html.mjs";

const template = `<html lang="%SITE_LANG%"><head><title>%SITE_NAME%</title>
<meta name="description" content="%SITE_DESCRIPTION%" />
%SITE_FONTS%
</head></html>`;

const site = {
  name: "Example",
  defaultLocale: "vi",
  seo: { description: "An example" },
  fonts: [{ href: "https://fonts.example/css?family=A&display=swap" }],
  preconnect: [
    { href: "https://fonts.example" },
    { href: "https://static.example", crossOrigin: true },
  ],
};

test("renderSiteHtml fills language, name, description and font links", () => {
  const html = renderSiteHtml(template, site);
  assert.match(html, /<html lang="vi">/);
  assert.match(html, /<title>Example<\/title>/);
  assert.match(html, /content="An example"/);
  assert.match(html, /<link rel="preconnect" href="https:\/\/fonts\.example" \/>/);
  assert.match(html, /<link rel="preconnect" href="https:\/\/static\.example" crossorigin \/>/);
  assert.match(
    html,
    /<link rel="stylesheet" href="https:\/\/fonts\.example\/css\?family=A&amp;display=swap" \/>/,
  );
  assert.doesNotMatch(html, /%SITE_/);
});

test("renderSiteHtml escapes HTML in site values", () => {
  const html = renderSiteHtml(template, {
    ...site,
    name: `A & "B" <c>`,
    seo: { description: `"quoted" <b>` },
  });
  assert.match(html, /<title>A &amp; &quot;B&quot; &lt;c&gt;<\/title>/);
  assert.match(html, /content="&quot;quoted&quot; &lt;b&gt;"/);
});

test("renderSiteHtml emits no font tags for a site without fonts", () => {
  const html = renderSiteHtml(template, { ...site, fonts: [], preconnect: undefined });
  assert.doesNotMatch(html, /<link/);
});

test("renderSiteHtml rejects an unknown placeholder", () => {
  assert.throws(() => renderSiteHtml("<title>%SITE_TITLE%</title>", site), /%SITE_TITLE%/);
});

test("cpanel.html renders the BiBi head from site/", async () => {
  const bibi = await loadSiteConfig("site");
  const html = renderSiteHtml(await readFile("cpanel.html", "utf8"), bibi);
  assert.match(html, /<html lang="vi">/);
  assert.match(html, /<title>BiBi Studio<\/title>/);
  assert.match(html, /content="BiBi Studio - so tay, thiep, postcard va giay viet thu/);
  assert.match(html, /fonts\.googleapis\.com\/css2\?family=Lora/);
  assert.match(html, /<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin \/>/);
});

test("loadSiteConfig names the missing file", async () => {
  await assert.rejects(loadSiteConfig("tests/missing-site"), (error) => {
    assert.match(
      error.message,
      /Site config not found: .*tests[\\/]missing-site[\\/]site\.config\.ts/,
    );
    return true;
  });
});

test("loadSiteConfig names a missing catalogue config", async (t) => {
  const { mkdtemp, rm, writeFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = await mkdtemp(join(tmpdir(), "site-html-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(join(dir, "site.config.ts"), "export default {};\n");
  await assert.rejects(
    loadSiteConfig(dir),
    /Site catalogue config not found: .*catalogue\.config\.ts/,
  );
});
