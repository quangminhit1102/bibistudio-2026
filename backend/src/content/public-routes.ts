import { Router, type Response } from "express";
import type { Pool } from "mysql2/promise";
import type { Clock } from "../config";
import { createContentPublicService } from "./public-service";

// Public content is the same for every visitor, so a browser may reuse it briefly.
// Only successful reads opt in: errors and misses keep the API-wide `no-store`.
const cached = (res: Response, body: unknown) => {
  res.setHeader("Cache-Control", "public, max-age=60");
  res.json(body);
};

export function contentPublicRoutes(pool: Pool, clock: Clock): Router {
  const r = Router();
  const svc = createContentPublicService(pool, clock);
  r.get("/posts", async (_req, res) => cached(res, await svc.listPosts()));
  r.get("/posts/:slug", async (req, res) => {
    const post = await svc.getPost(String(req.params.slug));
    if (!post) return res.status(404).json({ error: "Not found" });
    cached(res, post);
  });
  r.get("/products", async (_req, res) => cached(res, await svc.listProducts()));
  r.get("/products/:slug", async (req, res) => {
    const product = await svc.getProduct(String(req.params.slug));
    if (!product) return res.status(404).json({ error: "Not found" });
    cached(res, product);
  });
  r.get("/categories", async (req, res) =>
    cached(res, await svc.listCategories(String(req.query.scope ?? "product"))),
  );
  r.get("/collections", async (_req, res) => cached(res, await svc.listCollections()));
  return r;
}
