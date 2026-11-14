import { parentPort, workerData } from "node:worker_threads";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { CONTENT_LIMITS as L } from "../limits";
import type { EncodedContentVariant } from "./codec";
sharp.cache(false);
sharp.concurrency(1);
async function main() {
  const bytes = Buffer.from(workerData.bytes),
    mime = String(workerData.mimeType);
  const kind = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ? "png"
    : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      ? "jpeg"
      : bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP"
        ? "webp"
        : null;
  if (!kind || mime !== `image/${kind}`)
    return parentPort!.postMessage({ status: 415, code: "CONTENT_IMAGE_FORMAT" });
  const options = { limitInputPixels: L.mediaPixels, failOn: "warning" as const, animated: false };
  const metadata = await sharp(bytes, options).metadata();
  if (metadata.format !== kind || (metadata.pages ?? 1) > 1)
    return parentPort!.postMessage({ status: 415, code: "CONTENT_IMAGE_FORMAT" });
  if (!metadata.width || !metadata.height || metadata.width * metadata.height > L.mediaPixels)
    return parentPort!.postMessage({ status: 413, code: "CONTENT_IMAGE_TOO_LARGE" });
  const variants = new Map<string, EncodedContentVariant>();
  let total = 0;
  for (const edge of [480, 960, 1600, 2400]) {
    const { data, info } = await sharp(bytes, options)
      .rotate()
      .resize({ width: edge, height: edge, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .timeout({ seconds: 5 })
      .toBuffer({ resolveWithObject: true });
    const hash = createHash("sha256").update(data).digest("hex");
    if (!variants.has(hash)) total += data.length;
    if (total > 32 * 1024 ** 2) throw Error("Encoded image limit");
    variants.set(hash, {
      name: edge === 2400 ? "master" : `w${edge}`,
      data,
      hash,
      width: info.width,
      height: info.height,
    });
  }
  const values = [...variants.values()],
    master = values.find((variant) => variant.name === "master")!;
  parentPort!.postMessage({
    value: { width: master.width, height: master.height, variants: values },
  });
}
void main().catch((error) => {
  const pixels = error instanceof Error && /pixel limit|exceeds.*pixels/i.test(error.message);
  parentPort!.postMessage({
    status: pixels ? 413 : 400,
    code: pixels ? "CONTENT_IMAGE_TOO_LARGE" : "INVALID_CONTENT_IMAGE",
  });
});
