import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@site": fileURLToPath(new URL(process.env.SITE_DIR ?? "./site", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    include: [
      "tests/admin/**/*.test.{ts,tsx}",
      "src/lib/content-*.test.ts",
      "src/lib/catalogue-*.test.ts",
    ],
    setupFiles: ["tests/admin/setup.ts"],
    pool: "threads",
    maxWorkers: 2,
  },
});
