import { Router, json } from "express";
import { z } from "zod";
import type { AuthService, AuthPrincipal } from "../auth/service";
import { authenticate, requirePermission } from "../authorization/middleware";
import { requireBrowserOrigin, type SecurityConfig } from "../http/security";
import { validate } from "../http/validation";
import type { ContentService, ListInput } from "./service";
import { customerExtra, type ImportRow } from "./customer-import";
import { ApiError } from "../http/errors";

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
const id = (value: unknown) => validate(z.string().min(1).max(200), value);

const changesSomething = (value: object) => Object.keys(value).length > 1;
const categoryFields = {
  name: z.string().trim().min(1).max(191),
  slug: z.string().trim().min(1).max(191),
  description: z.string().nullable().optional(),
  parentId: uuid.nullable().optional(),
  position: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
};
// Per locale, the texts a public page shows: name, plural, tagline, intro.
const localizedFields = {
  translations: z
    .record(z.string().max(16), z.record(z.string().max(32), z.string().max(2000)))
    .nullable()
    .optional(),
  image: z.string().trim().max(500).nullable().optional(),
};
const optional = <T extends z.ZodRawShape>(shape: T) => z.object(shape).partial().shape;

const categoryCreate = z.object(categoryFields).strict();
const categoryUpdate = z
  .object({ revision, ...optional(categoryFields) })
  .strict()
  .refine(changesSomething);
const productCategoryCreate = z.object({ ...categoryFields, ...localizedFields }).strict();
const productCategoryUpdate = z
  .object({ revision, ...optional(categoryFields), ...localizedFields })
  .strict()
  .refine(changesSomething);

const { parentId: _noParent, ...productTypeFields } = categoryFields;
const productTypeCreate = z
  .object({
    // Stored on every product of the type, so it is set once and never renamed.
    code: z
      .string()
      .trim()
      .min(1)
      .max(50)
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    ...productTypeFields,
    ...localizedFields,
  })
  .strict();
const productTypeUpdate = z
  .object({ revision, ...optional(productTypeFields), ...localizedFields })
  .strict()
  .refine(changesSomething);

const attributes = z
  .record(
    z.string().min(1).max(64),
    z.union([
      z.string().max(2000),
      z.object({ vi: z.string().max(2000), en: z.string().max(2000) }).strict(),
    ]),
  )
  .refine((value) => Object.keys(value).length <= 50)
  .optional();

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
    representative: z.string().max(255).nullable().optional(),
    extra: customerExtra.optional(),
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
    representative: z.string().max(255).nullable().optional(),
    extra: customerExtra.optional(),
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
    authorId: uuid.nullable().optional(),
    status: z.string().max(16).optional(),
    publishAt: z.string().nullable().optional(),
    imageId: z.string().max(64).nullable().optional(),
    seoTitle: z.string().max(100).optional(),
    seoDescription: z.string().max(320).optional(),
    readTime: z.string().max(50).nullable().optional(),
    coverImageId: z.string().max(200).nullable().optional(),
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
    authorId: uuid.nullable().optional(),
    status: z.string().max(16).optional(),
    publishAt: z.string().nullable().optional(),
    imageId: z.string().max(64).nullable().optional(),
    seoTitle: z.string().max(100).optional(),
    seoDescription: z.string().max(320).optional(),
    readTime: z.string().max(50).nullable().optional(),
    coverImageId: z.string().max(200).nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 1);

const productCreate = z
  .object({
    productCode: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^\d{1,64}$/),
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
    nameEn: z.string().max(255).nullable().optional(),
    shortDescriptionEn: z.string().nullable().optional(),
    descriptionEn: z.string().nullable().optional(),
    dimensions: z.string().max(100).nullable().optional(),
    pages: z.string().max(50).nullable().optional(),
    materialVi: z.string().max(255).nullable().optional(),
    materialEn: z.string().max(255).nullable().optional(),
    formatVi: z.string().max(100).nullable().optional(),
    formatEn: z.string().max(100).nullable().optional(),
    occasion: z.string().max(64).nullable().optional(),
    featured: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
    imageAltVi: z.string().max(255).nullable().optional(),
    imageAltEn: z.string().max(255).nullable().optional(),
    attributes,
  })
  .strict();
const productUpdate = z
  .object({
    revision,
    productCode: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^\d{1,64}$/)
      .optional(),
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
    nameEn: z.string().max(255).nullable().optional(),
    shortDescriptionEn: z.string().nullable().optional(),
    descriptionEn: z.string().nullable().optional(),
    dimensions: z.string().max(100).nullable().optional(),
    pages: z.string().max(50).nullable().optional(),
    materialVi: z.string().max(255).nullable().optional(),
    materialEn: z.string().max(255).nullable().optional(),
    formatVi: z.string().max(100).nullable().optional(),
    formatEn: z.string().max(100).nullable().optional(),
    occasion: z.string().max(64).nullable().optional(),
    featured: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
    imageAltVi: z.string().max(255).nullable().optional(),
    imageAltEn: z.string().max(255).nullable().optional(),
    attributes,
  })
  .strict()
  .refine((value) => Object.keys(value).length > 1);

interface EntityApi {
  list(input: ListInput, actor: AuthPrincipal): Promise<unknown>;
  get(id: string, actor: AuthPrincipal): Promise<unknown>;
  create(input: unknown, actor: AuthPrincipal): Promise<unknown>;
  update(id: string, input: unknown, revision: number, actor: AuthPrincipal): Promise<unknown>;
  remove(id: string, revision: number, actor: AuthPrincipal): Promise<{ id: string }>;
}

function entity(
  service: EntityApi,
  permission: string,
  createSchema: z.ZodType<unknown>,
  updateSchema: z.ZodType<unknown>,
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
  r.get("/:id", authenticate(auth), requirePermission(`${permission}.view`), async (req, res) =>
    res.json(await service.get(id(req.params.id), req.auth!)),
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
      const body = validate(updateSchema, req.body) as { revision: number } & Record<
        string,
        unknown
      >;
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
      const { revision: version } = validate(z.object({ revision }).strict(), req.body);
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
  r.post(
    "/customers/import",
    authenticate(auth),
    write,
    requirePermission("customer.create"),
    json({ limit: "2mb", strict: true }),
    async (req, res) => {
      if (Array.isArray(req.body?.rows) && req.body.rows.length > 1000)
        throw new ApiError(400, "TOO_MANY_ROWS", "Tối đa 1.000 dòng mỗi lần import");
      const body = validate(
        z
          .object({
            dryRun: z.boolean(),
            rows: z
              .array(
                z
                  .object({
                    row: z.number().int().positive(),
                    action: z.enum(["create", "update", "skip"]).default("skip"),
                    targetId: uuid.optional(),
                    revision: revision.optional(),
                    fields: z.record(z.string(), z.unknown()),
                  })
                  .strict(),
              )
              .max(1000),
          })
          .strict(),
        req.body,
      );
      res.json(
        await service.importCustomers(body as { dryRun: boolean; rows: ImportRow[] }, req.auth!),
      );
    },
  );
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
  r.post(
    "/products/:id/stock-adjustments",
    authenticate(auth),
    write,
    requirePermission("product.update"),
    async (req, res) => {
      const body = validate(
        z
          .object({
            revision,
            delta: z
              .number()
              .int()
              .min(-2147483648)
              .max(2147483647)
              .refine((value) => value !== 0),
            reason: z.string().trim().min(1).max(500),
          })
          .strict(),
        req.body,
      );
      res.json(await service.adjustStock(id(req.params.id), body, req.auth!));
    },
  );
  r.get(
    "/stock-movements",
    authenticate(auth),
    requirePermission("product.view"),
    async (req, res) => {
      const query = validate(
        z
          .object({
            productId: uuid.optional(),
            page: z.coerce.number().int().min(1).max(100000).default(1),
            pageSize: z.coerce.number().int().min(1).max(500).default(20),
          })
          .strict(),
        req.query,
      );
      res.json(await service.listStockMovements(query, req.auth!));
    },
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
      productCategoryCreate,
      productCategoryUpdate,
      auth,
      write,
    ),
  );
  r.use(
    "/product-types",
    entity(
      {
        list: service.listProductTypes,
        get: service.getProductType,
        create: service.createProductType,
        update: service.updateProductType,
        remove: service.deleteProductType,
      },
      "product",
      productTypeCreate,
      productTypeUpdate,
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
