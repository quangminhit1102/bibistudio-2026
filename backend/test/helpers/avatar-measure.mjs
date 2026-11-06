import { readFile } from "node:fs/promises";
import { normalizeAvatar } from "../../dist/profile/avatar-codec.js";
const input = await readFile(process.argv[2]);
const started = performance.now();
const result = await normalizeAvatar(input, "image/png");
console.log(
  JSON.stringify({
    width: result.width,
    height: result.height,
    elapsedMs: Math.round(performance.now() - started),
    peakRssKiB: process.resourceUsage().maxRSS,
    rssBytes: process.memoryUsage().rss,
  }),
);
