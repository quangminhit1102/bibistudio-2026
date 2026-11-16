import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

/** A separate graph prevents shared compiler helpers from pulling React into documents. */
export default defineConfig({
  publicDir: false,
  plugins: [tailwindcss()],
  build: {
    outDir: "dist-cpanel",
    emptyOutDir: false,
    manifest: ".vite/blog-manifest.json",
    rollupOptions: { input: "src/blog-client.ts" },
  },
});
