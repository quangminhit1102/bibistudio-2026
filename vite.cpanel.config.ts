import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { existsSync, renameSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, type ConfigEnv, type Plugin } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackRouterGenerator } from "@tanstack/router-plugin/vite";

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
      tanstackRouterGenerator({ target: "react" }),
      react(),
      tailwindcss(),
      tsConfigPaths(),
      emitCpanelIndex(),
    ],
    build: {
      outDir: "dist-cpanel",
      emptyOutDir: true,
      rollupOptions: {
        input: "cpanel.html",
      },
    },
  };
});
