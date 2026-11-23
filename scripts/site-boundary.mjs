// Keeps site-specific values in `site/`: core folders may not contain the
// site's brand strings, and only `src/platform/site.ts` may import `@site/*`.
// Product types and collections are records in the database, so core code may
// not name one of the site's own either.
import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const SOURCE_FILE = /\.(ts|tsx|css|json)$/;
const SITE_ENTRY = "src/platform/site.ts";
const SITE_IMPORT = /["']@site\//;
// A relative path would always point at the default site, whatever SITE_DIR says.
const SITE_RELATIVE_PATH = /["'](\.\.\/)+site(\/|["'])/;

// Folders migrated so far. Later phases add `src/data`, the page routes and seeds.
export const phaseOneBoundary = {
  checkedDirs: [
    "src/components",
    "src/lib",
    "src/platform",
    "src/features/admin",
    "src/routes",
    "src/styles.css",
  ],
  exclude: [
    /^src\/features\/admin\/demo\/legacy-presentation\.json$/,
    /(^|\/)seed\.ts$/,
    /\.test\./,
  ],
  // Technical namespaces that keep their names (storage keys, cookies, headers, env).
  allow: [
    "bibi-admin",
    "bibi-media:",
    "bibi-analytics-cookie",
    "bibi.analytics.",
    "bibi:analytics-preference",
    "bibiimage",
    "bibi_refresh",
    "bibi_visitor",
    "X-Bibi-",
    "VITE_BIBI_",
    "bibi.admin",
    "BibiLocal",
  ],
  // The stylesheet is the one place that pulls in the site's theme file.
  siteImportFiles: [SITE_ENTRY, "src/platform/pages/", "src/styles.css"],
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function brandTokens(site) {
  const tokens = [site.name, site.shortName, site.contact?.phone, site.contact?.email];
  if (site.url) tokens.push(new URL(site.url).host);
  return [...new Set(tokens.filter((token) => typeof token === "string" && token.trim()))];
}

async function listFiles(root, entry) {
  const path = join(root, entry);
  let entries;
  try {
    entries = await readdir(path, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOTDIR") return [entry];
    if (error.code === "ENOENT") return [];
    throw error;
  }
  const files = [];
  for (const item of entries) {
    const child = join(entry, item.name);
    if (item.isDirectory()) files.push(...(await listFiles(root, child)));
    else files.push(child);
  }
  return files;
}

export async function findBoundaryViolations({
  root,
  site,
  checkedDirs,
  exclude = [],
  allow = [],
  siteImportFiles = [SITE_ENTRY],
  taxonomy = [],
  taxonomyExclude = [],
}) {
  // The site's product type codes, type slugs and collection slugs, as quoted literals.
  const named = taxonomy.length
    ? new RegExp("([\"'`])(" + taxonomy.map(escapeRegExp).join("|") + ")\\1")
    : undefined;
  const tokens = brandTokens(site).map((token) => ({
    token,
    pattern: new RegExp(escapeRegExp(token), "i"),
  }));
  const allowed = allow.length ? new RegExp(allow.map(escapeRegExp).join("|"), "gi") : undefined;
  const files = (await Promise.all(checkedDirs.map((dir) => listFiles(root, dir))))
    .flat()
    .map((file) => relative(root, join(root, file)).split(sep).join("/"))
    .filter((file) => SOURCE_FILE.test(file) && !exclude.some((rule) => rule.test(file)))
    .sort();
  const violations = [];
  for (const file of files) {
    const lines = (await readFile(join(root, file), "utf8")).split("\n");
    const checksTaxonomy = named && !taxonomyExclude.some((rule) => rule.test(file));
    // An entry ending in "/" allows every file of that folder.
    const mayImportSite = siteImportFiles.some((entry) =>
      entry.endsWith("/") ? file.startsWith(entry) : file === entry,
    );
    lines.forEach((text, index) => {
      const line = index + 1;
      const type = checksTaxonomy && named.exec(text);
      if (type)
        violations.push({
          file,
          line,
          reason: `names the site's product type or collection "${type[2]}"; read the lists from the API`,
        });
      if (SITE_IMPORT.test(text) && !mayImportSite)
        violations.push({
          file,
          line,
          reason: `imports @site directly; read site values through ${SITE_ENTRY}`,
        });
      if (SITE_RELATIVE_PATH.test(text))
        violations.push({
          file,
          line,
          reason: "uses a relative path into site/, which ignores SITE_DIR; use the @site alias",
        });
      const checked = allowed ? text.replace(allowed, "") : text;
      const hit = tokens.find(({ pattern }) => pattern.test(checked));
      if (hit)
        violations.push({
          file,
          line,
          reason: `contains the site value "${hit.token}"; read it from the site config`,
        });
    });
  }
  return violations;
}
