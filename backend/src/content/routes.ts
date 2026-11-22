import { Router } from "express";
import { z } from "zod";
import type { AuthService, AuthPrincipal } from "../auth/service";
import { authenticate, requirePermission } from "../authorization/middleware";
import { requireBrowserOrigin, type SecurityConfig } from "../http/security";
import { validate } from "../http/validation";
import type { ContentService, ListInput } from "./service";

const uuid = z.uuid();
const revision = z.number().int().positive();
const listQuery = z
  .object({
    q: z.string().max(100).optional(),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    size: z.coerce.number().int().min(1).max(1000).default(20),
    sort: z.string().max(64).optional(),
    dir: z.enum(["asc", "desc"]).optional(),
  })
  .catchall(z.string());
const id = (value: unknown) => validate(uuid, value);

const categoryCreate = z
  .object({
    name: z.string().trim().min(1).max(191),
    slug: z.string().trim().min(1).max(191),
    description: z.string().nullable().optional(),
    parentId: uuid.nullable().optional(),
    position: z.number().int().min(0).optional(),
    active: z.boolean().optional(),
  })
  .strict();
const categoryUpdate = z
  .object({
    revision,
    name: z.string().trim().min(1).max(191).optional(),
    slug: z.string().trim().min(1).max(191).optional(),
    description: z.string().nullable().optional(),
    parentId: uuid.nullable().optional(),
    position: z.number().int().min(0).optional(),
    active: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 1);

const customerCreate = z
  .object({
    name: z.string().trim().min(1).max(255),
    kind: z.string().trim().min(1).max(16),
    address: z.string().nullable().optional(),
    phone: z.string().max(50).nullable().optional(),
    email: z.email().max(254).nullable().optional(),
    vatRate: z.number().min(0).max(100).optional(),
    notes: z.string().nullable().optional(),
    active: z.boolean().optional(),
  })
  .strict();
const customerUpdate = z
  .object({
    revision,
    name: z.string().trim().min(1).max(255).optional(),
    kind: z.string().trim().min(1).max(16).optional(),
    address: z.string().nullable().optional(),
    phone: z.string().max(50).nullable().optional(),
    email: z.email().max(254).nullable().optional(),
    vatRate: z.number().min(0).max(100).optional(),
    notes: z.string().nullable().optional(),
    active: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 1);

const postCreate = z
  .object({
    slug: z.string().trim().min(1).max(191),
    title: z.string().trim().min(1).max(255),
    excerpt: z.string().nullable().optional(),
    content: z.string().min(1),
    categoryId: uuid.nullable().optional(),
    authorId: uuid.optional(),
    status: z.string().max(16).optional(),
    publishAt: z.string().nullable().optional(),
    imageId: z.string().max(64).nullable().optional(),
    seoTitle: z.string().max(100).optional(),
    seoDescription: z.string().max(320).optional(),
  })
  .strict();
const postUpdate = z
  .object({
    revision,
    slug: z.string().trim().min(1).max(191).optional(),
    title: z.string().trim().min(1).max(255).optional(),
    excerpt: z.string().nullable().optional(),
    content: z.string().min(1).optional(),
    categoryId: uuid.nullable().optional(),
    authorId: uuid.optional(),
    status: z.string().max(16).optional(),
    publishAt: z.string().nullable().optional(),
    imageId: z.string().max(64).nullable().optional(),
    seoTitle: z.string().max(100).optional(),
    seoDescription: z.string().max(320).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 1);

const productCreate = z
  .object({
    productCode: z.string().trim().min(1).max(64).regex(/^\d{1,64}$/),
    name: z.string().trim().min(1).max(255),
    slug: z.string().trim().min(1).max(191),
    shortDescription: z.string().nullable().optional(),
    description: z.string().min(1),
    productType: z.string().trim().min(1).max(50),
    collection: z.string().trim().min(1).max(50),
    categoryId: uuid.nullable().optional(),
    price: z.number().int().optional(),
    compareAt: z.number().int().optional(),
    stock: z.number().int().optional(),
    reserved: z.number().int().optional(),
    status: z.string().max(16).optional(),
    imageIds: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    seoTitle: z.string().max(100).optional(),
    seoDescription: z.string().max(320).optional(),
  })
  .strict();
const productUpdate = z
  .object({
    revision,
    productCode: z.string().trim().min(1).max(64).regex(/^\d{1,64}$/).optional(),
    name: z.string().trim().min(1).max(255).optional(),
    slug: z.string().trim().min(1).max(191).optional(),
    shortDescription: z.string().nullable().optional(),
    description: z.string().min(1).optional(),
    productType: z.string().trim().min(1).max(50).optional(),
    collection: z.string().trim().min(1).max(50).optional(),
    categoryId: uuid.nullable().optional(),
    price: z.number().int().optional(),
    compareAt: z.number().int().optional(),
    stock: z.number().int().optional(),
    reserved: z.number().int().optional(),
    status: z.string().max(16).optional(),
    imageIds: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    seoTitle: z.string().max(100).optional(),
    seoDescription: z.string().max(320).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 1);

interface EntityApi {
  list: (input: ListInput, actor: AuthPrincipal) => Promise<any>;
  get: (id: string, actor: AuthPrincipal) => Promise<any>;
  create: (input: any, actor: AuthPrincipal) => Promise<any>;
  update: (id: string, input: any, revision: number, actor: AuthPrincipal) => Promise<any>;
  remove: (id: string, revision: number, actor: AuthPrincipal) => Promise<{ id: string }>;
}

function entity(
  service: EntityApi,
  permission: string,
  createSchema: z.ZodType<any>,
  updateSchema: z.ZodType<any>,
  auth: AuthService,
  write: ReturnType<typeof requireBrowserOrigin>,
): Router {
  const r = Router();
  r.get("/", authenticate(auth), requirePermission(`${permission}.view`), async (req, res) => {
    const query = validate(listQuery, req.query);
    const filters: Record<string, string> = {};
    for (const [key, value] of Object.entries(query)) {
      if (key.startsWith("f_") && value !== undefined && value !== "")
        filters[key.slice(2)] = String(value);
    }
    const sort = query.sort ? `${query.sort}:${query.dir ?? "asc"}` : undefined;
    res.json(
      await service.list(
        { search: query.q, page: query.page, pageSize: query.size, sort, filters },
        req.auth!,
      ),
    );
  });
  r.get(
    "/:id",
    authenticate(auth),
    requirePermission(`${permission}.view`),
    async (req, res) => res.json(await service.get(id(req.params.id), req.auth!)),
  );
  r.post(
    "/",
    authenticate(auth),
    write,
    requirePermission(`${permission}.create`),
    async (req, res) =>
      res.status(201).json(await service.create(validate(createSchema, req.body), req.auth!)),
  );
  r.put(
    "/:id",
    authenticate(auth),
    write,
    requirePermission(`${permission}.update`),
    async (req, res) => {
      const body = validate<any>(updateSchema, req.body);
      const { revision: version, ...input } = body;
      res.json(await service.update(id(req.params.id), input, version, req.auth!));
    },
  );
  r.delete(
    "/:id",
    authenticate(auth),
    write,
    requirePermission(`${permission}.delete`),
    async (req, res) => {
      const { revision: version } = validate(
        z.object({ revision }).strict(),
        req.body,
      );
      res.json(await service.remove(id(req.params.id), version, req.auth!));
    },
  );
  return r;
}

export function contentRoutes(
  service: ContentService,
  auth: AuthService,
  config: SecurityConfig,
): Router {
  const r = Router();
  const write = requireBrowserOrigin(config);
  r.use(
    "/customers",
    entity(
      {
        list: service.listCustomers,
        get: service.getCustomer,
        create: service.createCustomer,
        update: service.updateCustomer,
        remove: service.deleteCustomer,
      },
      "customer",
      customerCreate,
      customerUpdate,
      auth,
      write,
    ),
  );
  r.use(
    "/posts",
    entity(
      {
        list: service.listPosts,
        get: service.getPost,
        create: service.createPost,
        update: service.updatePost,
        remove: service.deletePost,
      },
      "post",
      postCreate,
      postUpdate,
      auth,
      write,
    ),
  );
  r.use(
    "/products",
    entity(
      {
        list: service.listProducts,
        get: service.getProduct,
        create: service.createProduct,
        update: service.updateProduct,
        remove: service.deleteProduct,
      },
      "product",
      productCreate,
      productUpdate,
      auth,
      write,
    ),
  );
  r.use(
    "/product-categories",
    entity(
      {
        list: service.listProductCategories,
        get: service.getProductCategory,
        create: service.createProductCategory,
        update: service.updateProductCategory,
        remove: service.deleteProductCategory,
      },
      "product",
      categoryCreate,
      categoryUpdate,
      auth,
      write,
    ),
  );
  r.use(
    "/content-categories",
    entity(
      {
        list: service.listContentCategories,
        get: service.getContentCategory,
        create: service.createContentCategory,
        update: service.updateContentCategory,
        remove: service.deleteContentCategory,
      },
      "post",
      categoryCreate,
      categoryUpdate,
      auth,
      write,
    ),
  );
  return r;
}
