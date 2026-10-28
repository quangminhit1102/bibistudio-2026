import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const assetHost = "https://bibistudio-2026.lovable.app";

export function validateImage(bytes, contentType) {
  const jpeg =
    bytes.length >= 8 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff &&
    bytes[bytes.length - 2] === 0xff &&
    bytes[bytes.length - 1] === 0xd9;
  const png =
    bytes.length >= 24 &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const webp =
    bytes.length >= 16 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP";
  const type = jpeg ? "image/jpeg" : png ? "image/png" : webp ? "image/webp" : undefined;
  if (
    contentType &&
    !["image/jpeg", "image/png", "image/webp"].includes(contentType.split(";")[0].trim())
  ) {
    throw new Error(`Invalid content-type: ${contentType}`);
  }
  if (!type) throw new Error("Invalid image signature (possibly HTML or truncated image)");
  if (contentType && contentType.split(";")[0].trim() !== type)
    throw new Error("Image content-type does not match its bytes");
}

async function descriptors(root) {
  const dir = join(root, "src/assets/catalogue");
  const names = (await readdir(dir)).filter((name) => name.endsWith(".asset.json")).sort();
  if (!names.length) throw new Error("No catalogue asset descriptors found");
  return Promise.all(
    names.map(async (name) => {
      const path = join(dir, name);
      const data = JSON.parse(await readFile(path, "utf8"));
      if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.(?:jpe?g|png|webp)$/.test(data.original_filename ?? "")) {
        throw new Error(`Unsafe image filename in ${name}`);
      }
      return { path, data };
    }),
  );
}

async function validateLocal(root, data) {
  const expected = `/catalogue/${data.original_filename}`;
  if (data.url !== expected)
    throw new Error(`Unresolved Lovable or non-local catalogue URL: ${data.url}`);
  let bytes;
  try {
    bytes = await readFile(join(root, "public/catalogue", data.original_filename));
  } catch (error) {
    if (error.code === "ENOENT")
      throw new Error(`Missing catalogue image: ${data.original_filename}`);
    throw error;
  }
  validateImage(bytes);
}

export async function validateCatalogue(root) {
  for (const { data } of await descriptors(root)) await validateLocal(root, data);
}

export async function localizeCatalogue(root, fetchAsset = fetch) {
  const entries = await descriptors(root);
  const pending = [];
  for (const entry of entries) {
    const { data } = entry;
    if (data.url === `/catalogue/${data.original_filename}`) {
      await validateLocal(root, data);
      continue;
    }
    if (
      !data.url?.startsWith("/__l5e/assets-v1/") ||
      !/^[a-zA-Z0-9-]+$/.test(data.asset_id ?? "")
    ) {
      throw new Error(`Unsupported catalogue asset source: ${data.url}`);
    }
    const url = `${assetHost}/__l5e/assets-v1/${data.asset_id}/${data.original_filename}`;
    const response = await fetchAsset(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok)
      throw new Error(`Download failed (${response.status}): ${data.original_filename}`);
    const contentType = response.headers.get("content-type");
    if (!contentType) throw new Error(`Missing image content-type: ${data.original_filename}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    validateImage(bytes, contentType);
    if (data.size !== undefined && bytes.length !== data.size)
      throw new Error(`Image size mismatch: ${data.original_filename}`);
    pending.push({ ...entry, bytes });
  }
  // Finish every download before writing files or changing descriptor references.
  await mkdir(join(root, "public/catalogue"), { recursive: true });
  for (const { data, bytes } of pending) {
    await writeFile(join(root, "public/catalogue", data.original_filename), bytes);
  }
  for (const { path, data } of pending) {
    await writeFile(
      path,
      `${JSON.stringify({ ...data, url: `/catalogue/${data.original_filename}` }, null, 2)}\n`,
    );
  }
  await validateCatalogue(root);
  return pending.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    if (args.length && (args.length !== 1 || args[0] !== "--localize"))
      throw new Error("Usage: node scripts/catalogue-images.mjs [--localize]");
    if (args[0] === "--localize")
      console.log(`Localized ${await localizeCatalogue(process.cwd())} catalogue images.`);
    else {
      await validateCatalogue(process.cwd());
      console.log("Catalogue image validation passed (offline).");
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
