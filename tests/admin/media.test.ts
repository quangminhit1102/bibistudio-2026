import { it, expect } from "vitest";
import {
  validateImageFile,
  validateMediaUpload,
} from "../../src/features/admin/content/media/limits";
it("rejects SVG, HTML disguised as an image and files above5MiB", async () => {
  await expect(
    validateImageFile(new File(["<svg/>"], "x.svg", { type: "image/svg+xml" })),
  ).rejects.toThrow();
  await expect(
    validateImageFile(new File(["<html>"], "x.png", { type: "image/png" })),
  ).rejects.toThrow();
  await expect(
    validateImageFile(
      new File([new Uint8Array(5 * 1024 * 1024 + 1)], "x.png", { type: "image/png" }),
    ),
  ).rejects.toThrow();
});
it("media upload rejects WebP, files above2MiB and mismatched bytes", async () => {
  await expect(
    validateMediaUpload(new File(["<svg/>"], "x.webp", { type: "image/webp" })),
  ).rejects.toThrow();
  await expect(
    validateMediaUpload(
      new File([new Uint8Array(2 * 1024 * 1024 + 1)], "x.png", { type: "image/png" }),
    ),
  ).rejects.toThrow();
  await expect(
    validateMediaUpload(new File(["<html>"], "x.png", { type: "image/png" })),
  ).rejects.toThrow();
});
it("media upload accepts a valid PNG under 2 MiB", async () => {
  const b = new Uint8Array(16);
  b[0] = 137;
  b[1] = 80;
  b[2] = 78;
  b[3] = 71;
  b[4] = 13;
  b[5] = 10;
  await expect(
    validateMediaUpload(new File([b], "x.png", { type: "image/png" })),
  ).resolves.toBeUndefined();
});
