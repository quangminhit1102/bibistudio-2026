import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
const siteDir = process.env.SITE_DIR ?? "site";
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@site": fileURLToPath(new URL(siteDir, import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    include: [
      "tests/admin/**/*.test.{ts,tsx}",
      // What the active site declares about itself.
      `${siteDir.replace(/\/$/, "")}/tests/**/*.test.{ts,tsx}`,
      "src/lib/content-*.test.ts",
      "src/lib/catalogue-*.test.ts",
      "src/lib/messages.test.ts",
    ],
    setupFiles: ["tests/admin/setup.ts"],
    pool: "threads",
    maxWorkers: 2,
  },
});
