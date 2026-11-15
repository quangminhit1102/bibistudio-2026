import { readFile, lstat, realpath } from "node:fs/promises";
import { join, resolve, relative, isAbsolute } from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { ContentPaths, GenerationManifest, PublicSnapshot } from "../contracts";
import { parsePublicSnapshot, publicAssetPath } from "../public-schema";
import { serverMediaId } from "../rich-policy";
export const digest = (bytes: Uint8Array | string) =>
  createHash("sha256").update(bytes).digest("hex");
const id = z.string().refine(serverMediaId),
  hash = z.string().regex(/^[a-f0-9]{64}$/);
export const generationFile = (value: string) =>
  /^(?:pages\/[a-f0-9]{64}\.html|public\.json|route-map\.json|sitemap-blog\.xml)$/.test(value);
const variant = z.strictObject({
  hash,
  file: z.string().regex(/^[a-f0-9-]{36}\/[a-f0-9]{64}\.(?:webp|png|jpg)$/),
  mime: z.enum(["image/webp", "image/jpeg", "image/png"]),
  width: z.number().int().positive().max(2400),
  height: z.number().int().positive().max(2400),
  bytes: z
    .number()
    .int()
    .positive()
    .max(32 * 1024 ** 2),
});
const manifestSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id,
  previousId: id.nullable(),
  rendererVersion: z.literal("content-doc-v1"),
  publicDataFile: z.literal("public.json"),
  publicDataSha256: hash,
  routes: z.record(
    z.string(),
    z.union([
      z.strictObject({ kind: z.literal("redirect"), location: z.string(), status: z.literal(301) }),
      z.strictObject({
        kind: z.literal("html"),
        file: z.string().refine(generationFile),
        sha256: hash,
        indexable: z.boolean(),
        contentType: z.enum(["text/html", "application/xml"]),
      }),
    ]),
  ),
  media: z.record(z.string(), variant),
  assets: z.array(z.string().refine(publicAssetPath)).min(1).max(10000),
  fileHashes: z.record(z.string().refine(generationFile), hash),
});
export function parseGenerationManifest(raw: unknown): GenerationManifest {
  const result = manifestSchema.safeParse(raw);
  if (!result.success) throw Error("Invalid content generation manifest");
  const value = result.data;
  for (const [path, route] of Object.entries(value.routes)) {
    if (
      !/^\/(?:blog(?:[/?]|$)|sitemaps\/blog\.xml$)/.test(path) ||
      [...path].some((char) => char === "\\" || char === "#" || char.charCodeAt(0) <= 32)
    )
      throw Error("Invalid generation route");
    if (route.kind === "html" && value.fileHashes[route.file] !== route.sha256)
      throw Error("Generation route hash mismatch");
    if (route.kind === "redirect" && value.routes[route.location]?.kind !== "html")
      throw Error("Invalid generation redirect");
  }
  if (
    value.fileHashes[value.publicDataFile] !== value.publicDataSha256 ||
    !value.fileHashes["route-map.json"]
  )
    throw Error("Generation data hash missing");
  for (const [key, image] of Object.entries(value.media)) {
    const extension = image.mime === "image/jpeg" ? "jpg" : image.mime.split("/")[1];
    if (
      key !== image.hash + "." + extension ||
      !image.file.endsWith("/" + key) ||
      !serverMediaId(image.file.split("/")[0])
    )
      throw Error("Invalid generation media");
  }
  return value;
}
export async function regularBytes(root: string, file: string, maxBytes: number): Promise<Buffer> {
  const absolute = join(root, file),
    actual = await realpath(absolute),
    relation = relative(resolve(root), actual),
    info = await lstat(absolute);
  if (
    isAbsolute(relation) ||
    relation.startsWith("..") ||
    actual !== resolve(absolute) ||
    info.isSymbolicLink() ||
    !info.isFile() ||
    info.size > maxBytes
  )
    throw Error("Invalid private generation file");
  return readFile(absolute);
}
export async function readGeneration(
  paths: ContentPaths,
  id: string,
  expectedHash?: string,
): Promise<{ manifest: GenerationManifest; snapshot: PublicSnapshot; manifestSha256: string }> {
  if (!serverMediaId(id)) throw Error("Invalid generation ID");
  const directory = join(paths.generations, id);
  if (
    (await realpath(directory)) !== resolve(directory) ||
    (await lstat(directory)).isSymbolicLink()
  )
    throw Error("Invalid generation directory");
  const bytes = await regularBytes(directory, "manifest.json", 16 * 1024 ** 2),
    manifestSha256 = digest(bytes);
  if (expectedHash && manifestSha256 !== expectedHash)
    throw Error("Content manifest integrity hash mismatch");
  const manifest = parseGenerationManifest(JSON.parse(bytes.toString("utf8")));
  if (manifest.id !== id) throw Error("Content generation identity mismatch");
  const data = await regularBytes(directory, manifest.publicDataFile, 64 * 1024 ** 2);
  if (digest(data) !== manifest.publicDataSha256)
    throw Error("Content data integrity hash mismatch");
  const snapshot = parsePublicSnapshot(JSON.parse(data.toString("utf8")));
  if (snapshot.generationId !== id) throw Error("Content snapshot identity mismatch");
  return { manifest, snapshot, manifestSha256 };
}
export async function readActiveContent(paths: ContentPaths) {
  let bytes: Buffer;
  try {
    bytes = await regularBytes(paths.root, "active", 1024);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  const pointer = z
    .strictObject({ schemaVersion: z.literal(1), generationId: id, manifestSha256: hash })
    .parse(JSON.parse(bytes.toString("utf8")));
  return readGeneration(paths, pointer.generationId, pointer.manifestSha256);
}
