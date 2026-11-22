import { Router } from "express";
import type { Pool } from "mysql2/promise";
import type { Clock } from "../config";
import { createContentPublicService } from "./public-service";

export function contentPublicRoutes(pool: Pool, clock: Clock): Router {
  const r = Router();
  const svc = createContentPublicService(pool, clock);
  r.get("/posts", async (_req, res) => res.json(await svc.listPosts()));
  r.get("/posts/:slug", async (req, res) => {
    const post = await svc.getPost(String(req.params.slug));
    if (!post) return res.status(404).json({ error: "Not found" });
    res.json(post);
  });
  r.get("/products", async (_req, res) => res.json(await svc.listProducts()));
  r.get("/products/:slug", async (req, res) => {
    const product = await svc.getProduct(String(req.params.slug));
    if (!product) return res.status(404).json({ error: "Not found" });
    res.json(product);
  });
  r.get("/categories", async (req, res) =>
    res.json(await svc.listCategories(String(req.query.scope ?? "product"))),
  );
  r.get("/collections", async (_req, res) => res.json(await svc.listCollections()));
  return r;
}
