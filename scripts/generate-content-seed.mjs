import ts from "typescript";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { root, isMain } from "./runtime.mjs";

// Static-content extraction mirrors scripts/analytics-catalogue.mjs: the TS data files
// import image assets and call Vite helpers at module scope, so they are never executed.
// We walk their AST instead, extracting the literal values the backend seed needs.

function array(source, variable) {
  const file = ts.createSourceFile(variable + ".ts", source, ts.ScriptTarget.Latest, true);
  let found;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === variable)
      found = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(file);
  while (found && (ts.isAsExpression(found) || ts.isSatisfiesExpression(found)))
    found = found.expression;
  if (!found || !ts.isArrayLiteralExpression(found))
    throw new Error(`Content seed requires a literal ${variable} array`);
  return found.elements;
}

function string(node) {
  if (!node || (!ts.isStringLiteral(node) && !ts.isNoSubstitutionTemplateLiteral(node)))
    throw new Error("Content seed fields must be literal strings");
  return node.text;
}

function number(node) {
  if (!node || !ts.isNumericLiteral(node))
    throw new Error("Content seed fields must be literal numbers");
  return Number(node.text);
}

function property(node, key) {
  if (!ts.isObjectLiteralExpression(node)) throw new Error("Unsupported content seed object");
  const item = node.properties.find(
    (value) =>
      ts.isPropertyAssignment(value) &&
      (ts.isIdentifier(value.name) || ts.isStringLiteral(value.name)) &&
      value.name.text === key,
  );
  if (!item) return undefined;
  return item.initializer;
}

function required(node, key) {
  const value = property(node, key);
  if (!value) throw new Error(`Missing content seed ${key}`);
  return value;
}

function slug(node) {
  const result = string(node);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result) || result.length > 160)
    throw new Error("Invalid content slug");
  return result;
}

// Matches src/features/admin/content/seed.ts escapeHtml + ContentBlock mapping exactly.
function escapeHtml(text) {
  return String(text).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

function blocksToHtml(postSlug, contentArray) {
  return contentArray
    .map((block, index) => {
      const type = string(required(block, "type"));
      if (type === "image") {
        const alt = escapeHtml(string(required(block, "alt")));
        const captionNode = property(block, "caption");
        const caption = captionNode
          ? `<figcaption>${escapeHtml(string(captionNode))}</figcaption>`
          : "";
        return `<figure><img data-media-id="journal-inline-${postSlug}-${index}" alt="${alt}">${caption}</figure>`;
      }
      const levelNode = property(block, "level");
      const level = levelNode ? number(levelNode) : 2;
      const tag = type === "heading" ? `h${level}` : type === "quote" ? "blockquote" : "p";
      return `<${tag}>${escapeHtml(string(required(block, "text")))}</${tag}>`;
    })
    .join("");
}

function transliterate(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function categorySlug(name) {
  const result = transliterate(name);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result) || result.length > 160)
    throw new Error(`Unsupported category name for slug: ${name}`);
  return result;
}

function optionalString(node) {
  return node ? string(node) : null;
}

function boolean(node) {
  if (
    !node ||
    (node.kind !== ts.SyntaxKind.TrueKeyword && node.kind !== ts.SyntaxKind.FalseKeyword)
  )
    throw new Error("Content seed fields must be literal booleans");
  return node.kind === ts.SyntaxKind.TrueKeyword;
}

// Default imports by local name, e.g. `import main from "@/assets/catalogue/main.jpg.asset.json"`.
function collectImports(source) {
  const file = ts.createSourceFile("source.ts", source, ts.ScriptTarget.Latest, true);
  const imports = new Map();
  function visit(node) {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.importClause &&
      node.importClause.name &&
      ts.isIdentifier(node.importClause.name)
    )
      imports.set(node.importClause.name.text, node.moduleSpecifier.text);
    ts.forEachChild(node, visit);
  }
  visit(file);
  return imports;
}

// Journal images are public files named through `journalImage("<file>")`, either inline or
// as a constant. The seed stores the public path, which the public API returns as it is.
function journalImages(source) {
  const file = ts.createSourceFile("blog.ts", source, ts.ScriptTarget.Latest, true);
  const constants = new Map();
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer)
      constants.set(node.name.text, node.initializer);
    ts.forEachChild(node, visit);
  }
  visit(file);
  return constants;
}

// `posts.image_id` is VARCHAR(64).
function storedCover(path) {
  if (path.length > 64) throw new Error(`Cover image path is longer than 64 characters: ${path}`);
  return path;
}

function coverImageUrl(node, constants) {
  let value = property(node, "coverImage");
  if (!value) return null;
  if (ts.isIdentifier(value)) value = constants.get(value.text);
  if (value && (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)))
    return storedCover(value.text);
  if (
    value &&
    ts.isCallExpression(value) &&
    ts.isIdentifier(value.expression) &&
    value.expression.text === "journalImage"
  )
    return storedCover("/journal/" + string(value.arguments[0]));
  throw new Error("Unsupported cover image source");
}

// A product image is a public path, written out or read from an imported `.asset.json`
// (`asset.url`, optionally wrapped in a helper that adds the base path).
function productImageUrl(node, imports, assets) {
  if (ts.isCallExpression(node) && node.arguments.length === 1) node = node.arguments[0];
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (
    ts.isPropertyAccessExpression(node) &&
    node.name.text === "url" &&
    ts.isIdentifier(node.expression)
  ) {
    const url = assets[imports.get(node.expression.text)];
    if (typeof url === "string") return url;
  }
  throw new Error("Unsupported product image source");
}

function buildPosts(blog) {
  const constants = journalImages(blog);
  return array(blog, "blogPosts").map((node) => {
    const postSlug = slug(required(node, "slug"));
    const content = required(node, "content");
    if (!ts.isArrayLiteralExpression(content))
      throw new Error("Blog content must be a literal array");
    return {
      slug: postSlug,
      title: string(required(node, "title")),
      excerpt: string(required(node, "excerpt")),
      content: blocksToHtml(postSlug, content.elements),
      categorySlug: categorySlug(string(required(node, "category"))),
      status: "published",
      publishAt: string(required(node, "date")),
      // The admin's cover picker edits `image_id`, so the cover goes there: a path kept in
      // `cover_image_id` would win over every later replacement.
      imageId: coverImageUrl(node, constants),
      readTime: optionalString(property(node, "readTime")),
      coverImageId: null,
      seoTitle: "",
      seoDescription: "",
    };
  });
}

function buildProducts(catalogue, assets) {
  const imports = collectImports(catalogue);
  return array(catalogue, "products").map((node, index) => {
    if (
      !ts.isCallExpression(node) ||
      !ts.isIdentifier(node.expression) ||
      node.expression.text !== "p"
    )
      throw new Error("Unsupported product source shape");
    const args = node.arguments;
    const productSlug = slug(args[0]);
    const images = args[7];
    if (!ts.isArrayLiteralExpression(images))
      throw new Error("Product images must be a literal array");
    const imageIds = images.elements.map((image) => productImageUrl(image, imports, assets));
    const nameVi = string(args[1]);
    const nameEn = string(args[2]);
    const descriptionVi = string(args[5]);
    const descriptionEn = string(args[6]);
    return {
      productCode: String(index + 1).padStart(4, "0"),
      name: nameVi,
      slug: productSlug,
      shortDescription: descriptionVi,
      description: descriptionVi,
      productType: string(args[3]),
      collection: string(args[4]),
      categorySlug: string(args[4]),
      status: "published",
      imageIds,
      tags: [],
      seoTitle: "",
      seoDescription: "",
      nameEn,
      shortDescriptionEn: descriptionEn,
      descriptionEn,
      dimensions: null,
      pages: null,
      materialVi: null,
      materialEn: null,
      formatVi: null,
      formatEn: null,
      occasion: optionalString(args[9]),
      featured: args[8] ? boolean(args[8]) : false,
      sortOrder: index + 1,
      imageAltVi: `${nameVi} — sản phẩm BiBi Studio`,
      imageAltEn: `${nameEn} — a BiBi Studio paper good`,
    };
  });
}

// `{ vi: { name, tagline }, en: { name } }` from the localized fields of a catalogue entry.
function translations(node, fields) {
  const result = {};
  for (const field of fields) {
    const value = property(node, field);
    if (!value) continue;
    if (!ts.isObjectLiteralExpression(value)) throw new Error("Unsupported content seed object");
    for (const item of value.properties) {
      if (!ts.isPropertyAssignment(item) || !ts.isIdentifier(item.name))
        throw new Error("Unsupported content seed object");
      (result[item.name.text] ??= {})[field] = string(item.initializer);
    }
  }
  return result;
}

// An image computed at build time has no stable public path; the page keeps its bundled one.
function literalImage(node) {
  const value = property(node, "image");
  return value && (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value))
    ? value.text
    : null;
}

function buildProductCategories(catalogue) {
  return array(catalogue, "collections").map((node, index) => ({
    slug: slug(required(node, "slug")),
    name: string(required(required(node, "name"), "vi")),
    description: string(required(required(node, "intro"), "vi")),
    position: index,
    translations: translations(node, ["name", "tagline", "intro"]),
    image: literalImage(node),
  }));
}

function buildProductTypes(catalogue) {
  return array(catalogue, "productTypes").map((node, index) => ({
    code: slug(required(node, "id")),
    slug: slug(required(node, "slug")),
    name: string(required(required(node, "name"), "vi")),
    description: string(required(required(node, "tagline"), "vi")),
    position: index,
    translations: translations(node, ["name", "plural", "tagline"]),
    image: literalImage(node),
  }));
}

function buildContentCategories(blog) {
  const seen = new Map();
  for (const node of array(blog, "blogPosts")) {
    const name = string(required(node, "category"));
    if (!seen.has(name)) seen.set(name, categorySlug(name));
  }
  return [...seen.entries()].map(([name, slugValue], index) => ({
    slug: slugValue,
    name,
    position: index,
  }));
}

/** `assets` maps the import specifier of each `.asset.json` the catalogue imports to its `url`. */
export function buildContentSeed(catalogue, blog, assets = {}) {
  const posts = buildPosts(blog);
  const products = buildProducts(catalogue, assets);
  const productCategories = buildProductCategories(catalogue);
  const productTypes = buildProductTypes(catalogue);
  const contentCategories = buildContentCategories(blog);
  const postSlugs = new Set(posts.map((p) => p.slug));
  if (postSlugs.size !== posts.length) throw new Error("Duplicate blog post slug");
  const productSlugs = new Set(products.map((p) => p.slug));
  if (productSlugs.size !== products.length) throw new Error("Duplicate product slug");
  const productCodes = new Set(products.map((p) => p.productCode));
  if (productCodes.size !== products.length) throw new Error("Duplicate product code");
  const typeCodes = new Set(productTypes.map((t) => t.code));
  if (typeCodes.size !== productTypes.length) throw new Error("Duplicate product type");
  return { posts, products, productCategories, productTypes, contentCategories };
}

/** The public path of every `.asset.json` the catalogue imports, by import specifier. */
export async function readCatalogueAssets(catalogue, directory = root) {
  const assets = {};
  for (const specifier of collectImports(catalogue).values()) {
    if (!specifier.startsWith("@/") || !specifier.endsWith(".asset.json")) continue;
    const file = join(directory, "src", specifier.slice(2));
    assets[specifier] = JSON.parse(await readFile(file, "utf8")).url;
  }
  return assets;
}

export async function writeContentSeed(directory = root) {
  const [catalogue, blog] = await Promise.all([
    readFile(join(directory, "src/data/catalogue.ts"), "utf8"),
    readFile(join(directory, "src/data/blog.ts"), "utf8"),
  ]);
  const seed = buildContentSeed(catalogue, blog, await readCatalogueAssets(catalogue, directory));
  const json = JSON.stringify(seed, null, 2) + "\n";
  await Promise.all([
    writeFile(join(directory, "src/data/content-seed.generated.json"), json),
    writeFile(join(directory, "backend/content-seed.json"), json),
  ]);
  return seed;
}

if (isMain(import.meta.url)) {
  await writeContentSeed();
  console.log("Content seed generated");
}
