import { Router } from "express";
import { z } from "zod";
import type { AuthService } from "../auth/service";
import type { SecurityConfig } from "../http/security";
import { requireBrowserOrigin } from "../http/security";
import { validate } from "../http/validation";
import { authenticate, requirePermission } from "../authorization/middleware";
import type { AccountService } from "./service";
import { phoneSchema } from "../profile/validation";

export function accountRoutes(
  accounts: AccountService,
  auth: AuthService,
  config: SecurityConfig,
): Router {
  const router = Router();
  router.use(authenticate(auth));
  const browser = requireBrowserOrigin(config);
  const revision = z.number().int().positive();
  const username = z
    .string()
    .trim()
    .min(3)
    .max(64)
    .regex(/^[a-zA-Z0-9_.-]+$/);
  const password = z
    .string()
    .min(8)
    .refine((value) => Buffer.byteLength(value, "utf8") <= 72);
  const displayName = z.string().trim().min(1).max(160);
  const email = z.email().max(254).nullable().optional();
  const roleIds = z
    .array(z.string().min(1).max(36))
    .max(20)
    .refine((ids) => new Set(ids).size === ids.length);
  const id = (value: unknown) => validate(z.uuid(), value);
  router.get("/", requirePermission("account.view"), async (req, res) => {
    const query = validate(
      z
        .object({
          search: z.string().max(100).default(""),
          page: z.coerce.number().int().min(1).max(100000).default(1),
          pageSize: z.coerce.number().int().min(1).max(100).default(20),
        })
        .strict(),
      req.query,
    );
    res.json(await accounts.list(query, req.auth!));
  });
  router.get("/:id", requirePermission("account.view"), async (req, res) =>
    res.json(await accounts.get(id(req.params.id), req.auth!)),
  );
  router.post("/", browser, requirePermission("account.create"), async (req, res) => {
    const input = validate(
      z
        .object({
          username,
          password,
          displayName,
          email,
          phone: phoneSchema,
          roleIds: roleIds.default([]),
        })
        .strict(),
      req.body,
    );
    res.status(201).json(await accounts.create(input, req.auth!));
  });
  router.put("/:id", browser, requirePermission("account.update"), async (req, res) => {
    const { revision: version, ...input } = validate(
      z
        .object({
          revision,
          username: username.optional(),
          displayName: displayName.optional(),
          email,
          phone: phoneSchema,
          password: password.optional(),
        })
        .strict()
        .refine((value) => Object.keys(value).length > 1),
      req.body,
    );
    res.json(await accounts.update(id(req.params.id), input, version, req.auth!));
  });
  for (const active of [true, false])
    router.patch(
      `/:id/${active ? "activate" : "deactivate"}`,
      browser,
      requirePermission(active ? "account.activate" : "account.deactivate"),
      async (req, res) => {
        const input = validate(z.object({ revision }).strict(), req.body);
        res.json(await accounts.setActive(id(req.params.id), active, input.revision, req.auth!));
      },
    );
  router.patch(
    "/:id/roles",
    browser,
    requirePermission("account.assign_role"),
    async (req, res) => {
      const input = validate(z.object({ revision, roleIds }).strict(), req.body);
      res.json(
        await accounts.setRoles(id(req.params.id), input.roleIds, input.revision, req.auth!),
      );
    },
  );
  router.delete("/:id", browser, requirePermission("account.delete"), async (req, res) => {
    const input = validate(z.object({ revision }).strict(), req.body);
    await accounts.remove(id(req.params.id), input.revision, req.auth!);
    res.sendStatus(204);
  });
  return router;
}
