import { it, expect } from "vitest";
import { validateImageFile } from "../../src/features/admin/content/media/limits";
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
