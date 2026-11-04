import { Router } from "express";
import { z } from "zod";
import type { AuthService } from "../auth/service";
import type { SecurityConfig } from "../http/security";
import { requireBrowserOrigin } from "../http/security";
import { validate } from "../http/validation";
import { authenticate, requirePermission } from "../authorization/middleware";
import type { RoleService } from "./service";

export function roleRoutes(roles: RoleService, auth: AuthService, config: SecurityConfig): Router {
  const router = Router();
  router.use(authenticate(auth));
  const browser = requireBrowserOrigin(config);
  const revision = z.number().int().positive();
  const name = z.string().trim().min(1).max(100);
  const description = z.string().trim().max(500);
  const permissionIds = z
    .array(z.string().min(1).max(100))
    .max(200)
    .refine((ids) => new Set(ids).size === ids.length);
  const id = (value: unknown) =>
    validate(
      z
        .string()
        .min(1)
        .max(36)
        .regex(/^[a-zA-Z0-9_-]+$/),
      value,
    );
  router.get("/options", requirePermission("account.assign_role"), async (req, res) =>
    res.json(await roles.listAssignableRoles(req.auth!)),
  );
  router.get("/", requirePermission("role.view"), async (req, res) =>
    res.json(await roles.list(req.auth!)),
  );
  router.post("/", browser, requirePermission("role.create"), async (req, res) => {
    const input = validate(
      z
        .object({
          name,
          description: description.default(""),
          permissionIds: permissionIds.default([]),
        })
        .strict(),
      req.body,
    );
    res.status(201).json(await roles.create(input, req.auth!));
  });
  router.put("/:id", browser, requirePermission("role.update"), async (req, res) => {
    const { revision: version, ...input } = validate(
      z
        .object({ revision, name: name.optional(), description: description.optional() })
        .strict()
        .refine((value) => Object.keys(value).length > 1),
      req.body,
    );
    res.json(await roles.update(id(req.params.id), input, version, req.auth!));
  });
  router.patch(
    "/:id/permissions",
    browser,
    requirePermission("role.assign_permission"),
    async (req, res) => {
      const input = validate(z.object({ revision, permissionIds }).strict(), req.body);
      res.json(
        await roles.setPermissions(
          id(req.params.id),
          input.permissionIds,
          input.revision,
          req.auth!,
        ),
      );
    },
  );
  router.delete("/:id", browser, requirePermission("role.delete"), async (req, res) => {
    const input = validate(z.object({ revision }).strict(), req.body);
    await roles.remove(id(req.params.id), input.revision, req.auth!);
    res.sendStatus(204);
  });
  return router;
}
