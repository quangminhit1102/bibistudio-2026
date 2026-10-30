import { defineConfig, mergeConfig } from "vite";
import cpanelConfig from "./vite.cpanel.config.ts";

export default defineConfig(async (env) =>
  mergeConfig(await cpanelConfig(env), {
    plugins: [
      {
        name: "local-csr-document",
        configureServer(server) {
          server.middlewares.use((req, _res, next) => {
            const path = (req.url ?? "/").split("?")[0];
            if (
              req.method === "GET" &&
              req.headers.accept?.includes("text/html") &&
              !path.startsWith("/api/") &&
              !path.includes(".")
            )
              req.url = "/cpanel.html";
            next();
          });
        },
      },
    ],
    server: {
      strictPort: true,
      host: "127.0.0.1",
      port: 5173,
      proxy: { "/api": `http://127.0.0.1:${process.env.BACKEND_PORT ?? 3001}` },
    },
  }),
);
