import express, { Router, type RequestHandler } from "express";
import { z } from "zod";
import type { AuthService } from "../auth/service";
import { authenticate } from "../authorization/middleware";
import { requireBrowserOrigin, type SecurityConfig } from "../http/security";
import { ApiError } from "../http/errors";
import { validate } from "../http/validation";
import { CONTENT_LIMITS } from "./limits";
import { validatePostDraft, validateCategory } from "./validation";
import type { ContentEditing } from "./editing";
import type { ContentLookups } from "./lookups";
import type { readContentCapabilities } from "./capabilities";
import type { ContentPublication } from "./publication/publisher";
import { validatePublicationRequest, isCategory } from "./publication/jobs";
const query = z.object({
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(100).optional(),
});
export function contentRoutes(
  editing: ContentEditing,
  lookups: ContentLookups,
  auth: AuthService,
  config: SecurityConfig,
  capabilities: ReturnType<typeof readContentCapabilities>,
  publication?: ContentPublication,
): Router {
  const router = Router(),
    base = "/api/content",
    browser = requireBrowserOrigin(config),
    parser = express.json({ limit: CONTENT_LIMITS.requestBytes, strict: true });
  router.use(base, authenticate(auth));
  router.use(base, (req, _res, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && !capabilities.canWrite)
      throw new ApiError(503, "CONTENT_READ_ONLY", "Nội dung đang ở chế độ chỉ đọc");
    next();
  });
  router.get(base + "/capabilities", async (req, res) => {
    try {
      await editing.preflight(req.auth!, "post.view");
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 403) throw error;
      await editing.preflight(req.auth!, "content_category.view");
    }
    res.json(capabilities);
  });
  const mutation = (permission: string): RequestHandler[] => [
    browser,
    async (req, _res, next) => {
      await editing.preflight(req.auth!, permission);
      next();
    },
    parser,
  ];
  router.post(
    base + "/publications",
    browser,
    async (req, _res, next) => {
      try {
        await editing.preflight(req.auth!, "post.publish");
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 403) throw error;
        await editing.preflight(req.auth!, "content_category.publish");
      }
      next();
    },
    express.json({ limit: "4kb", strict: true }),
    async (req, res) => {
      const input = validatePublicationRequest(req.body);
      await editing.preflight(
        req.auth!,
        isCategory(input) ? "content_category.publish" : "post.publish",
      );
      if (!publication)
        throw new ApiError(503, "CONTENT_NOT_READY", "Dịch vụ xuất bản chưa sẵn sàng");
      res.status(202).json(await publication.request(req.auth!, input));
    },
  );
  router.get(base + "/publications/:id", async (req, res) => {
    if (!publication)
      throw new ApiError(503, "CONTENT_NOT_READY", "Dịch vụ xuất bản chưa sẵn sàng");
    res.json(await publication.status(req.auth!, validate(z.uuid(), req.params.id)));
  });
  router.get(base + "/posts", async (req, res) =>
    res.json(
      await editing.list(
        req.auth!,
        validate(
          query
            .extend({
              status: z.enum(["draft", "published", "trash"]).optional(),
              categoryId: z.uuid().optional(),
              sort: z.enum(["updated_desc", "published_desc"]).optional(),
            })
            .strict(),
          req.query,
        ),
      ),
    ),
  );
  router.get(base + "/posts/:id", async (req, res) =>
    res.json(await editing.get(req.auth!, validate(z.uuid(), req.params.id))),
  );
  router.post(base + "/posts", ...mutation("post.create"), async (req, res) => {
    const value = validate(z.strictObject({ input: z.unknown() }), req.body);
    res
      .status(201)
      .json(await editing.saveDraft(req.auth!, null, validatePostDraft(value.input), null));
  });
  router.put(base + "/posts/:id", ...mutation("post.update"), async (req, res) => {
    const value = validate(
      z.strictObject({ input: z.unknown(), expectedRevision: z.number().int().positive() }),
      req.body,
    );
    res.json(
      await editing.saveDraft(
        req.auth!,
        validate(z.uuid(), req.params.id),
        validatePostDraft(value.input),
        value.expectedRevision,
      ),
    );
  });
  router.post(base + "/posts/:id/duplicate", ...mutation("post.create"), async (req, res) =>
    res.status(201).json(await editing.duplicate(req.auth!, validate(z.uuid(), req.params.id))),
  );
  for (const restore of [false, true])
    router.post(
      base + `/posts/:id/${restore ? "restore" : "trash"}`,
      ...mutation(restore ? "post.restore" : "post.delete"),
      async (req, res) => {
        const value = validate(
          z.strictObject({ expectedRevision: z.number().int().positive() }),
          req.body,
        );
        res.json(
          await editing[restore ? "restoreDraft" : "trashDraft"](
            req.auth!,
            validate(z.uuid(), req.params.id),
            value.expectedRevision,
          ),
        );
      },
    );
  router.get(base + "/categories", async (req, res) =>
    res.json(await editing.listCategories(req.auth!, validate(query.strict(), req.query))),
  );
  router.get(base + "/categories/:id", async (req, res) =>
    res.json(await editing.getCategory(req.auth!, validate(z.uuid(), req.params.id))),
  );
  router.post(base + "/categories", ...mutation("content_category.create"), async (req, res) => {
    const value = validate(z.strictObject({ input: z.unknown() }), req.body);
    res
      .status(201)
      .json(await editing.saveCategory(req.auth!, null, validateCategory(value.input), null));
  });
  router.put(base + "/categories/:id", ...mutation("content_category.update"), async (req, res) => {
    const value = validate(
      z.strictObject({ input: z.unknown(), expectedRevision: z.number().int().positive() }),
      req.body,
    );
    res.json(
      await editing.saveCategory(
        req.auth!,
        validate(z.uuid(), req.params.id),
        validateCategory(value.input),
        value.expectedRevision,
      ),
    );
  });
  router.delete(
    base + "/categories/:id",
    ...mutation("content_category.delete"),
    async (req, res) => {
      const value = validate(
        z.strictObject({ expectedRevision: z.number().int().positive() }),
        req.body,
      );
      await editing.removeUnusedCategory(
        req.auth!,
        validate(z.uuid(), req.params.id),
        value.expectedRevision,
      );
      res.sendStatus(204);
    },
  );
  for (const [path, method] of [
    ["authors", "authors"],
    ["tags", "tags"],
    ["category-choices", "categoryChoices"],
  ] as const)
    router.get(base + "/" + path, async (req, res) =>
      res.json(await lookups[method](req.auth!, validate(query.strict(), req.query))),
    );
  return router;
}
