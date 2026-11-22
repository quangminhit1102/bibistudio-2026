import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { existsSync, renameSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, type ConfigEnv, type Plugin } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanStackRouterCodeSplitter, tanstackRouterGenerator } from "@tanstack/router-plugin/vite";

const emitCpanelIndex = (): Plugin => ({
  name: "emit-cpanel-index",
  closeBundle() {
    const outputDir = join(process.cwd(), "dist-cpanel");
    const source = join(outputDir, "cpanel.html");
    const target = join(outputDir, "index.html");

    if (existsSync(source)) {
      renameSync(source, target);
    }
  },
});

export default defineConfig(({ mode }: ConfigEnv) => {
  const isTempUrl = mode === "cpanel-temp";
  const basepath = isTempUrl ? "/~vhplasti" : "/";

  return {
    base: isTempUrl ? `${basepath}/` : "/",
    define: {
      "import.meta.env.VITE_BIBI_CSR": JSON.stringify("true"),
      "import.meta.env.VITE_ROUTER_BASEPATH": JSON.stringify(basepath),
    },
    plugins: [
      // Each route's component loads on demand; loaders and head stay in the entry chunk.
      tanstackRouterGenerator({ target: "react" }),
      tanStackRouterCodeSplitter({ target: "react", autoCodeSplitting: true }),
      react(),
      tailwindcss(),
      tsConfigPaths(),
      emitCpanelIndex(),
    ],
    build: {
      manifest: true,
      outDir: "dist-cpanel",
      emptyOutDir: true,
      rollupOptions: {
        input: "cpanel.html",
      },
    },
  };
});
