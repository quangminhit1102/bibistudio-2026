import express, { type Express } from "express";
import type { ReleaseInfo } from "./release";

export function createApp(release: ReleaseInfo): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use((req, res, next) => {
    if (process.env.NODE_ENV !== "production") {
      const start = performance.now();
      res.once("finish", () =>
        console.log(
          `${req.method} ${req.path} ${res.statusCode} ${Math.round(performance.now() - start)}ms`,
        ),
      );
    }
    next();
  });
  const endpoints = ["/api/health", "/api/version", "/api/demo"];
  app.use((req, res, next) => {
    if (endpoints.includes(req.path) && !["GET", "HEAD"].includes(req.method)) {
      res.setHeader("Allow", "GET, HEAD");
      res.status(405).json({ error: "Method not allowed" });
    } else next();
  });
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });
  app.get("/api/version", (_req, res) => {
    res.json({ releaseId: release.releaseId, sourceSha: release.sourceSha });
  });
  app.get("/api/demo", (_req, res) => {
    res.json({
      message: "Hello from BiBi Studio API",
      framework: "Express",
      items: ["React", "Express", "cPanel"],
    });
  });
  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });
  return app;
}
