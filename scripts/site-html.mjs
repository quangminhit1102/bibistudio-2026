import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { defineMessages } from "../src/platform/site-contract.ts";

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

function fontLinks(site) {
  const preconnect = (site.preconnect ?? []).map(
    ({ href, crossOrigin }) =>
      `<link rel="preconnect" href="${escapeHtml(href)}"${crossOrigin ? " crossorigin" : ""} />`,
  );
  const stylesheets = site.fonts.map(
    ({ href }) => `<link rel="stylesheet" href="${escapeHtml(href)}" />`,
  );
  return [...preconnect, ...stylesheets].join("\n    ");
}

/** Fills the `%SITE_*%` placeholders of an HTML entry file from a site config. */
export function renderSiteHtml(html, site) {
  const values = {
    SITE_LANG: escapeHtml(site.defaultLocale),
    SITE_NAME: escapeHtml(site.name),
    SITE_DESCRIPTION: escapeHtml(site.seo.description),
    SITE_FONTS: fontLinks(site),
  };
  return html.replace(/%(SITE_[A-Z_]+)%/g, (placeholder, key) => {
    if (!(key in values)) throw new Error(`Unknown site placeholder ${placeholder}`);
    return values[key];
  });
}

/** Files the core imports from every site, besides its two configs. */
const siteFiles = ["messages/vi.ts", "pages/home.tsx", "pages/about.tsx", "pages/contact.tsx"];

export async function loadSiteConfig(siteDir = process.env.SITE_DIR ?? "site") {
  const file = resolve(siteDir, "site.config.ts");
  if (!existsSync(file)) throw new Error(`Site config not found: ${file}`);
  const catalogue = resolve(siteDir, "catalogue.config.ts");
  if (!existsSync(catalogue)) throw new Error(`Site catalogue config not found: ${catalogue}`);
  for (const name of siteFiles) {
    const path = resolve(siteDir, name);
    if (!existsSync(path)) throw new Error(`Site file not found: ${path}`);
  }
  const load = async (path) => (await import(pathToFileURL(path).href)).default;
  // The cPanel build does not type-check the site, so its texts are checked here.
  defineMessages(await load(resolve(siteDir, "messages/vi.ts")));
  return load(file);
}

/** Vite plugin: renders the HTML entry with the active site's values. */
export function siteHtmlPlugin(siteDir) {
  let site;
  return {
    name: "site-html",
    async configResolved() {
      site = await loadSiteConfig(siteDir);
    },
    transformIndexHtml: { order: "pre", handler: (html) => renderSiteHtml(html, site) },
  };
}
