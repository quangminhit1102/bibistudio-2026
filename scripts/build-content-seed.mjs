import { createServer } from "vite";
import { mkdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve, sep } from "node:path";
import { createHash } from "node:crypto";
import { root, isMain } from "./runtime.mjs";
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
export async function buildContentSeed({ outputDir }) {
  const server = await createServer({
    root,
    configFile: false,
    logLevel: "silent",
    resolve: { alias: { "@": join(root, "src") } },
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, watch: null },
    appType: "custom",
  });
  let originals;
  try {
    originals = (await server.ssrLoadModule("/src/data/blog.ts")).getAllBlogPosts();
  } finally {
    await server.close();
  }
  const imageRoot = await realpath(join(root, "src/assets/blog")),
    images = new Map(),
    sources = new Map();
  async function image(url) {
    if (sources.has(url)) return sources.get(url);
    if (
      typeof url !== "string" ||
      !/^\/src\/assets\/blog\/[a-zA-Z0-9_-]+\.(?:jpe?g|png|webp)$/.test(url)
    )
      throw Error("Seed requires a local bundled journal image");
    const source = await realpath(resolve(root, url.slice(1))),
      info = await stat(source);
    if (
      !source.startsWith(imageRoot + sep) ||
      !info.isFile() ||
      info.size < 1 ||
      info.size > 5242880
    )
      throw Error("Invalid or oversized seed image");
    const bytes = await readFile(source),
      sha256 = digest(bytes),
      extension = extname(source).toLowerCase(),
      file = `images/${sha256}${extension}`;
    images.set(file, {
      file,
      sha256,
      bytes: bytes.length,
      mime:
        extension === ".png" ? "image/png" : extension === ".webp" ? "image/webp" : "image/jpeg",
      originalName: basename(source),
      data: bytes,
    });
    sources.set(url, file);
    return file;
  }
  const posts = [];
  for (const original of originals) {
    const post = {
      ...original,
      sourceKey: "blog:" + original.slug,
      coverImage: await image(original.coverImage),
      content: [],
    };
    for (const block of original.content)
      post.content.push(
        block.type === "image" ? { ...block, src: await image(block.src) } : { ...block },
      );
    posts.push(post);
  }
  const ordered = [...images.values()].sort((a, b) =>
      a.file < b.file ? -1 : a.file > b.file ? 1 : 0,
    ),
    seed = {
      schemaVersion: 1,
      posts,
      images: ordered.map(({ file, sha256, bytes, mime, originalName }) => ({
        file,
        sha256,
        bytes,
        mime,
        originalName,
      })),
    };
  const bytes = Buffer.from(JSON.stringify(seed, null, 2) + "\n"),
    sha256 = digest(bytes),
    directory = resolve(outputDir),
    manifestFile = join(directory, "seed.json");
  await mkdir(join(directory, "images"), { recursive: true });
  for (const item of ordered)
    await writeFile(join(directory, item.file), item.data, { flag: "wx" });
  await writeFile(manifestFile, bytes, { flag: "wx" });
  await writeFile(join(directory, "seed.sha256"), sha256 + "\n", { flag: "wx" });
  return { manifestFile, sha256 };
}
if (isMain(import.meta.url)) {
  if (process.argv.length !== 3) throw Error("Usage: build-content-seed.mjs OUTPUT_DIRECTORY");
  const result = await buildContentSeed({ outputDir: process.argv[2] });
  console.log(JSON.stringify(result));
}
