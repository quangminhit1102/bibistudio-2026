import ts from "typescript";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { root, isMain } from "./runtime.mjs";

function array(source, variable) {
  const file = ts.createSourceFile("catalogue.ts", source, ts.ScriptTarget.Latest, true);
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
    throw new Error(`Analytics manifest requires a literal ${variable} array`);
  return found.elements;
}
function string(node) {
  if (!node || (!ts.isStringLiteral(node) && !ts.isNoSubstitutionTemplateLiteral(node)))
    throw new Error("Analytics public labels must be literal strings");
  return node.text;
}
function property(node, key) {
  if (!ts.isObjectLiteralExpression(node)) throw new Error("Unsupported public catalogue object");
  const item = node.properties.find(
    (value) =>
      ts.isPropertyAssignment(value) &&
      (ts.isIdentifier(value.name) || ts.isStringLiteral(value.name)) &&
      value.name.text === key,
  );
  if (!item) throw new Error(`Missing public catalogue ${key}`);
  return item.initializer;
}
function slug(node) {
  const result = string(node);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result) || result.length > 160)
    throw new Error("Invalid public route slug");
  return result;
}
export function buildAnalyticsCatalogue(catalogue, blog) {
  const products = array(catalogue, "products").map((node) => {
    if (
      !ts.isCallExpression(node) ||
      !ts.isIdentifier(node.expression) ||
      node.expression.text !== "p"
    )
      throw new Error("Unsupported product source shape");
    return { slug: slug(node.arguments[0]), name: string(node.arguments[1]) };
  });
  const types = array(catalogue, "productTypes").map((node) => ({
    slug: slug(property(node, "slug")),
    name: string(property(property(node, "name"), "vi")),
  }));
  const collections = array(catalogue, "collections").map((node) => ({
    slug: slug(property(node, "slug")),
    name: string(property(property(node, "name"), "vi")),
  }));
  const articles = array(blog, "blogPosts").map((node) => ({
    slug: slug(property(node, "slug")),
    title: string(property(node, "title")),
  }));
  const seen = new Set(types.map((type) => type.slug));
  for (const product of products) {
    if (seen.has(product.slug)) throw new Error("Duplicate product or type/detail slug collision");
    seen.add(product.slug);
  }
  const routes = [
    { path: "/", label: "Trang chủ" },
    { path: "/products", label: "Sản phẩm" },
    { path: "/collections", label: "Bộ sưu tập" },
    { path: "/blog", label: "Nhật ký" },
    { path: "/about", label: "Về BiBi" },
    { path: "/contact", label: "Liên hệ" },
    ...types.map((type) => ({ path: `/products/${type.slug}`, label: type.name })),
    ...products.map((product) => ({ path: `/products/${product.slug}`, label: product.name })),
    ...collections.map((collection) => ({
      path: `/collections/${collection.slug}`,
      label: collection.name,
    })),
    ...articles.map((article) => ({ path: `/blog/${article.slug}`, label: article.title })),
  ];
  if (new Set(routes.map((route) => route.path)).size !== routes.length)
    throw new Error("Duplicate public route");
  return {
    version: 1,
    routes: routes.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)),
    products: products.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0)),
  };
}
export async function writeAnalyticsCatalogue(directory = root) {
  const [catalogue, blog] = await Promise.all([
    readFile(join(directory, "src/data/catalogue.ts"), "utf8"),
    readFile(join(directory, "src/data/blog.ts"), "utf8"),
  ]);
  const manifest = buildAnalyticsCatalogue(catalogue, blog);
  const json = JSON.stringify(manifest, null, 2) + "\n";
  await Promise.all([
    writeFile(join(directory, "src/data/analytics-catalogue.generated.json"), json),
    writeFile(join(directory, "backend/analytics-catalogue.json"), json),
  ]);
  return manifest;
}
if (isMain(import.meta.url)) {
  await writeAnalyticsCatalogue();
  console.log("Public analytics catalogue generated");
}
