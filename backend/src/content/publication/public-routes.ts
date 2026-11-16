import { Router } from "express";
import { ApiError } from "../../http/errors";
import type { PublicSnapshot } from "../contracts";
export interface PublicContentRead {
  activeRead: () => Promise<PublicSnapshot | null>;
  legacyAllowed: () => Promise<boolean>;
}
export function publicContentRoutes(source: PublicContentRead): Router {
  const router = Router();
  router.use("/api/public/content", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  async function active() {
    try {
      return await source.activeRead();
    } catch {
      throw new ApiError(503, "CONTENT_NOT_READY", "Nội dung công khai chưa sẵn sàng");
    }
  }
  router.get("/api/public/content/routes", async (_req, res) => {
    const snapshot = await active();
    if (snapshot)
      return res.json({
        schemaVersion: 1,
        mode: "cms",
        generationId: snapshot.generationId,
        routes: snapshot.routes,
      });
    let legacy = false;
    try {
      legacy = await source.legacyAllowed();
    } catch {
      /* Missing or corrupt bootstrap fails closed. */
    }
    if (legacy)
      return res.json({ schemaVersion: 1, mode: "legacy", generationId: null, routes: [] });
    throw new ApiError(503, "CONTENT_NOT_READY", "Nội dung công khai chưa sẵn sàng");
  });
  router.get("/api/public/content/posts", async (_req, res) => {
    const snapshot = await active();
    if (!snapshot) throw new ApiError(503, "CONTENT_NOT_READY", "Nội dung công khai chưa sẵn sàng");
    res.json(snapshot);
  });
  router.get("/api/public/content/posts/:slug", async (req, res) => {
    const snapshot = await active();
    if (!snapshot) throw new ApiError(503, "CONTENT_NOT_READY", "Nội dung công khai chưa sẵn sàng");
    const post = snapshot.posts.find((item) => item.slug === req.params.slug);
    if (!post) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy bài viết");
    res.json(post);
  });
  return router;
}
