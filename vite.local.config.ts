import { defineConfig, mergeConfig } from "vite";
import cpanelConfig from "./vite.cpanel.config.ts";
import {
  isLocalContentPath,
  isLocalContentBoundary,
  proxyLocalContent,
  serveLocalContentAsset,
} from "./scripts/local-content-proxy.mjs";

export default defineConfig(async (env) =>
  mergeConfig(await cpanelConfig(env), {
    plugins: [
      {
        name: "local-csr-document",
        configureServer(server) {
          const contentUrl = process.env.LOCAL_PHP_CONTENT_URL,
            contentAssets = process.env.BIBI_CONTENT_ASSET_ROOT;
          server.middlewares.use((req, res, next) => {
            if (contentUrl && isLocalContentBoundary(req.url ?? "")) {
              if (!isLocalContentPath(req.url ?? "")) {
                res.writeHead(404, { "Cache-Control": "no-store" });
                res.end();
                return;
              }
              proxyLocalContent(req, res, contentUrl);
              return;
            }
            void serveLocalContentAsset(req, res, contentAssets).then((served) => {
              if (!served) next();
            }, next);
          });
          server.middlewares.use((req, _res, next) => {
            const path = (req.url ?? "/").split("?")[0];
            if (
              req.method === "GET" &&
              req.headers.accept?.includes("text/html") &&
              path !== "/api" &&
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
      // Match the actual dev lifecycle: generated/private assets are not HMR inputs.
      watch: {
        ignored: [
          "**/.superpowers/**",
          "**/.releases/**",
          "**/dist-cpanel/**",
          "**/.output/**",
          "**/backend/dist/**",
        ],
      },
      proxy: {
        ...(process.env.LOCAL_PHP_RELAY_URL
          ? {
              "^/api/analytics/relay/collect\\.php(?:\\?|$)": {
                target: process.env.LOCAL_PHP_RELAY_URL,
              },
            }
          : {}),
        "^/api(?:/|$)": `http://127.0.0.1:${process.env.BACKEND_PORT ?? 3001}`,
      },
    },
  }),
);
