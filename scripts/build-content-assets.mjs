import { readFile, writeFile, realpath, lstat, mkdir } from "node:fs/promises";
import { resolve, join, sep, dirname } from "node:path";
const forbidden =
  /(?:^|[\/_-])(?:admin|tinymce|cpanel|main|index|react|jsx-runtime)(?:[\/_\-.]|$)/i;
export async function buildContentAssets({
  frontendDir,
  outputFile,
  staticRoutes = [],
  rendererVersion = "content-doc-v1",
}) {
  const root = await realpath(frontendDir);
  async function local(file) {
    if (
      typeof file !== "string" ||
      !/^[a-zA-Z0-9][a-zA-Z0-9_./-]*$/.test(file) ||
      file.split("/").some((part) => !part || part === "." || part === "..") ||
      !/\.(?:js|css|woff2?|png|jpe?g|webp|svg|ico)$/.test(file) ||
      forbidden.test(file)
    )
      throw Error("Forbidden public asset path");
    const candidate = join(root, file),
      actual = await realpath(candidate),
      info = await lstat(candidate);
    if (
      !actual.startsWith(root + sep) ||
      !info.isFile() ||
      info.isSymbolicLink() ||
      !info.size ||
      info.size > 10 * 1024 ** 2
    )
      throw Error("Invalid public asset path or size");
    if (
      file.endsWith(".js") &&
      /tinymce|admin-entry|features\/admin|react\.transitional\.element|react\.production|AUTH_JWT_SECRET|DB_PASSWORD|PRIVATE KEY/i.test(
        await readFile(actual, "utf8"),
      )
    )
      throw Error("Forbidden editor or private code in public entry");
  }
  const manifest = JSON.parse(await readFile(join(root, ".vite/blog-manifest.json"), "utf8")),
    entry = manifest["src/blog-client.ts"];
  if (!entry || entry.isEntry !== true)
    throw Error("Dedicated blog entry missing; SPA entry is not supported");
  const visited = new Set(),
    files = new Set(),
    css = new Set();
  async function walk(key) {
    if (visited.has(key)) return;
    if (typeof key !== "string" || forbidden.test(key) || !manifest[key])
      throw Error("Forbidden or missing public module");
    visited.add(key);
    const node = manifest[key];
    for (const name of ["imports", "dynamicImports", "css", "assets"])
      if (
        node[name] !== undefined &&
        (!Array.isArray(node[name]) || node[name].some((value) => typeof value !== "string"))
      )
        throw Error("Invalid public build manifest");
    for (const dependency of [...(node.imports ?? []), ...(node.dynamicImports ?? [])])
      await walk(dependency);
    for (const file of [node.file, ...(node.css ?? []), ...(node.assets ?? [])]) {
      await local(file);
      files.add("/" + file);
      if (file.endsWith(".css")) css.add("/" + file);
    }
  }
  await walk("src/blog-client.ts");
  if (!css.size) throw Error("Public stylesheet missing");
  if (!/^[a-zA-Z0-9._-]{1,100}$/.test(rendererVersion))
    throw Error("Invalid public renderer version");
  const routes = staticRoutes
    .filter(
      (route) =>
        typeof route.path === "string" &&
        route.path.startsWith("/") &&
        !/^\/(?:blog|admin|api|preview)(?:\/|$)/.test(route.path),
    )
    .map((route) => ({
      path: route.path,
      ...(typeof route.lastmod === "string" ? { lastmod: route.lastmod } : {}),
    }));
  const result = {
    schemaVersion: 1,
    rendererVersion,
    css: [...css],
    script: "/" + entry.file,
    assets: [...files].sort(),
    staticRoutes: routes,
  };
  await mkdir(dirname(resolve(outputFile)), { recursive: true });
  await writeFile(outputFile, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
  return result;
}
