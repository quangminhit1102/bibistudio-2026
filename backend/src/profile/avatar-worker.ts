import { parentPort, workerData } from "node:worker_threads";
import jpeg from "jpeg-js";
import { PNG } from "pngjs";
import type { ImageHeader } from "./avatar-header";
try {
  const header = workerData.header as ImageHeader,
    bytes = Buffer.from(workerData.bytes);
  const decoded =
    header.format === "png"
      ? PNG.sync.read(bytes, { checkCRC: true })
      : jpeg.decode(bytes, {
          useTArray: true,
          formatAsRGBA: true,
          tolerantDecoding: false,
          maxResolutionInMP: 16,
          maxMemoryUsageInMB: 128,
        });
  if (decoded.width !== header.width || decoded.height !== header.height)
    throw new Error("Image dimensions changed");
  const rotated = header.orientation >= 5,
    ow = rotated ? header.height : header.width,
    oh = rotated ? header.width : header.height;
  const scale = Math.min(1, 512 / ow, 512 / oh),
    width = Math.max(1, Math.round(ow * scale)),
    height = Math.max(1, Math.round(oh * scale));
  const data = Buffer.alloc(width * height * 4);
  const point = (x: number, y: number) => {
    const w = header.width,
      h = header.height;
    switch (header.orientation) {
      case 2:
        return (y * w + w - 1 - x) * 4;
      case 3:
        return ((h - 1 - y) * w + w - 1 - x) * 4;
      case 4:
        return ((h - 1 - y) * w + x) * 4;
      case 5:
        return (x * w + y) * 4;
      case 6:
        return ((h - 1 - x) * w + y) * 4;
      case 7:
        return ((h - 1 - x) * w + w - 1 - y) * 4;
      case 8:
        return (x * w + w - 1 - y) * 4;
      default:
        return (y * w + x) * 4;
    }
  };
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const u = Math.max(0, ((x + 0.5) * ow) / width - 0.5),
        v = Math.max(0, ((y + 0.5) * oh) / height - 0.5),
        x0 = Math.floor(u),
        y0 = Math.floor(v),
        fx = u - x0,
        fy = v - y0;
      const samples = [
        [point(x0, y0), (1 - fx) * (1 - fy)],
        [point(Math.min(ow - 1, x0 + 1), y0), fx * (1 - fy)],
        [point(x0, Math.min(oh - 1, y0 + 1)), (1 - fx) * fy],
        [point(Math.min(ow - 1, x0 + 1), Math.min(oh - 1, y0 + 1)), fx * fy],
      ];
      const alpha = samples.reduce((sum, [at, weight]) => sum + decoded.data[at + 3] * weight, 0),
        to = (y * width + x) * 4;
      for (let c = 0; c < 3; c++)
        data[to + c] = alpha
          ? Math.round(
              samples.reduce(
                (sum, [at, weight]) => sum + decoded.data[at + c] * decoded.data[at + 3] * weight,
                0,
              ) / alpha,
            )
          : 0;
      data[to + 3] = Math.round(alpha);
    }
  const bitmap = new PNG({ width, height });
  bitmap.data = data;
  const output =
    header.format === "png"
      ? PNG.sync.write(bitmap, { colorType: 6 })
      : jpeg.encode({ width, height, data }, 85).data;
  parentPort!.postMessage({
    ok: true,
    image: { bytes: output, width, height, format: header.format },
  });
} catch (error) {
  parentPort!.postMessage({
    ok: false,
    limit: error instanceof Error && /maxMemoryUsageInMB|maxResolutionInMP/.test(error.message),
  });
}
