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

// Blog cover images are Vite asset imports (e.g. `import cover from "@/assets/blog/foo.jpg"`),
// so `coverImage` is an identifier in the AST. Resolve it back to its import specifier and
// normalise to the static URL the public site serves ("old images keep static URL").
function collectImports(source) {
  const file = ts.createSourceFile("blog.ts", source, ts.ScriptTarget.Latest, true);
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

function staticAssetUrl(specifier) {
  return specifier.startsWith("@/") ? "/" + specifier.slice(2) : specifier;
}

function coverImageUrl(node, imports) {
  const value = property(node, "coverImage");
  if (!value) return null;
  if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) return value.text;
  if (ts.isIdentifier(value)) {
    const specifier = imports.get(value.text);
    if (specifier) return staticAssetUrl(specifier);
    throw new Error("Unresolved cover image import");
  }
  throw new Error("Unsupported cover image source");
}

function buildPosts(blog) {
  const imports = collectImports(blog);
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
      imageId: "journal-cover-" + postSlug,
      readTime: optionalString(property(node, "readTime")),
      coverImageId: coverImageUrl(node, imports),
      seoTitle: "",
      seoDescription: "",
    };
  });
}

function buildProducts(catalogue) {
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
    const imageIds = images.elements.map((_, k) => `catalogue-image-${productSlug}-${k}`);
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

function buildProductCategories(catalogue) {
  return array(catalogue, "collections").map((node, index) => ({
    slug: slug(required(node, "slug")),
    name: string(required(required(node, "name"), "vi")),
    description: string(required(required(node, "intro"), "vi")),
    position: index,
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

export function buildContentSeed(catalogue, blog) {
  const posts = buildPosts(blog);
  const products = buildProducts(catalogue);
  const productCategories = buildProductCategories(catalogue);
  const contentCategories = buildContentCategories(blog);
  const postSlugs = new Set(posts.map((p) => p.slug));
  if (postSlugs.size !== posts.length) throw new Error("Duplicate blog post slug");
  const productSlugs = new Set(products.map((p) => p.slug));
  if (productSlugs.size !== products.length) throw new Error("Duplicate product slug");
  const productCodes = new Set(products.map((p) => p.productCode));
  if (productCodes.size !== products.length) throw new Error("Duplicate product code");
  return { posts, products, productCategories, contentCategories };
}

export async function writeContentSeed(directory = root) {
  const [catalogue, blog] = await Promise.all([
    readFile(join(directory, "src/data/catalogue.ts"), "utf8"),
    readFile(join(directory, "src/data/blog.ts"), "utf8"),
  ]);
  const seed = buildContentSeed(catalogue, blog);
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
