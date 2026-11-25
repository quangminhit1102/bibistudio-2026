import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import type { Clock } from "../config";
import type { AuthPrincipal } from "../auth/service";
import { sqlDate } from "../auth/repository";
import { withRbacWrite, lockAuthorizedUsers } from "../authorization/transaction";
import { assertPermission } from "../authorization/permissions";
import { writeAudit } from "../audit/repository";
import { ApiError } from "../http/errors";
import { assertContentReady } from "./schema";
import {
  customerExtra,
  duplicateKeys,
  validateImportFields,
  type ImportRow,
  type ImportResult,
} from "./customer-import";
import {
  attributesFromLegacy,
  legacyAttributeKeys,
  legacyFromAttributes,
  mergeAttributes,
  type Attributes,
  type LegacyAttributeColumns,
} from "./legacy-attributes";

export interface ListInput {
  search?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  filters?: Record<string, string | number | boolean | undefined>;
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** `{ "<locale>": { name, plural?, tagline?, intro? } }` */
export type Translations = Record<string, Record<string, string>>;

export interface CategoryInput {
  name: string;
  slug: string;
  description?: string | null;
  parentId?: string | null;
  position?: number;
  active?: boolean;
  /** Product categories only. */
  translations?: Translations | null;
  image?: string | null;
}
export interface CategoryDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  position: number;
  active: boolean;
  /** Product categories only. */
  translations?: Translations | null;
  image?: string | null;
  createdAt: string;
  updatedAt: string;
  revision: number;
}
export interface ProductTypeInput extends Omit<CategoryInput, "parentId"> {
  /** What products store in `productType`. Set once; `slug` is the URL segment. */
  code: string;
}
export interface ProductTypeDto {
  id: string;
  code: string;
  name: string;
  slug: string;
  description: string | null;
  position: number;
  active: boolean;
  translations: Translations | null;
  image: string | null;
  createdAt: string;
  updatedAt: string;
  revision: number;
}
export interface CustomerInput {
  name: string;
  kind: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  vatRate?: number;
  notes?: string | null;
  active?: boolean;
  representative?: string | null;
  extra?: Record<string, string | number | boolean | null>;
}
export interface CustomerDto {
  id: string;
  name: string;
  kind: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  vatRate: number;
  notes: string | null;
  active: boolean;
  representative: string | null;
  extra: Record<string, string | number | boolean | null> | null;
  createdAt: string;
  updatedAt: string;
  revision: number;
}
export interface PostInput {
  slug: string;
  title: string;
  excerpt?: string | null;
  content: string;
  categoryId?: string | null;
  authorId?: string | null;
  status?: string;
  publishAt?: string | Date | null;
  imageId?: string | null;
  seoTitle?: string;
  seoDescription?: string;
  readTime?: string | null;
  coverImageId?: string | null;
}
export interface PostDto {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  categoryId: string | null;
  authorId: string;
  status: string;
  publishAt: string | null;
  imageId: string | null;
  seoTitle: string;
  seoDescription: string;
  readTime: string | null;
  coverImageId: string | null;
  createdAt: string;
  updatedAt: string;
  revision: number;
}
export interface ProductInput {
  productCode: string;
  name: string;
  slug: string;
  shortDescription?: string | null;
  description: string;
  productType: string;
  collection: string;
  categoryId?: string | null;
  price?: number;
  compareAt?: number;
  stock?: number;
  reserved?: number;
  status?: string;
  imageIds?: string[];
  tags?: string[];
  seoTitle?: string;
  seoDescription?: string;
  nameEn?: string | null;
  shortDescriptionEn?: string | null;
  descriptionEn?: string | null;
  dimensions?: string | null;
  pages?: string | null;
  materialVi?: string | null;
  materialEn?: string | null;
  formatVi?: string | null;
  formatEn?: string | null;
  occasion?: string | null;
  featured?: boolean;
  sortOrder?: number;
  imageAltVi?: string | null;
  imageAltEn?: string | null;
  /** Keyed by the site's attribute key. In an update it replaces the whole set. */
  attributes?: Attributes;
}
export interface StockMovementDto {
  id: string;
  productId: string;
  productName: string;
  delta: number;
  stockBefore: number;
  stockAfter: number;
  reason: string;
  source: string;
  actorId: string | null;
  actorName: string | null;
  createdAt: string;
}
export interface ProductDto {
  id: string;
  productCode: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string;
  productType: string;
  collection: string;
  categoryId: string | null;
  price: number;
  compareAt: number;
  stock: number;
  reserved: number;
  status: string;
  imageIds: string[];
  tags: string[];
  seoTitle: string;
  seoDescription: string;
  nameEn: string | null;
  shortDescriptionEn: string | null;
  descriptionEn: string | null;
  dimensions: string | null;
  pages: string | null;
  materialVi: string | null;
  materialEn: string | null;
  formatVi: string | null;
  formatEn: string | null;
  occasion: string | null;
  featured: boolean;
  sortOrder: number;
  imageAltVi: string | null;
  imageAltEn: string | null;
  attributes: Attributes;
  createdAt: string;
  updatedAt: string;
  revision: number;
}

const iso = (value: unknown): string | null =>
  value == null ? null : sqlDate(String(value)).toISOString();
const jsonStrings = (value: unknown): string[] => {
  if (value == null) return [];
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
};
const toDate = (value: string | Date | null | undefined): Date | null =>
  value == null ? null : value instanceof Date ? value : new Date(value);
const notFound = (): ApiError => new ApiError(404, "NOT_FOUND", "Không tìm thấy bản ghi");
const conflict = (): ApiError =>
  new ApiError(409, "CONFLICT", "Dữ liệu đã thay đổi, vui lòng tải lại");
const referenced = (): ApiError =>
  new ApiError(409, "REFERENCED", "Không thể xóa dữ liệu đang được tham chiếu");
const unknownValue = (fields: string[]): ApiError =>
  new ApiError(
    400,
    "INVALID_INPUT",
    "Dữ liệu không hợp lệ",
    fields.map((field) => ({ field, message: "Giá trị không tồn tại" })),
  );

const invalidSlug = (message: string): ApiError =>
  new ApiError(400, "INVALID_INPUT", "Dữ liệu không hợp lệ", [{ field: "slug", message }]);
const slugInUse = (): ApiError => invalidSlug("Đường dẫn đã được dùng");
// A product stores its collection's slug in a column of this many characters.
const collectionSlugLength = 50;
const assertCollectionSlug = (slug: string) => {
  if (slug.length > collectionSlugLength)
    throw invalidSlug(`Đường dẫn dài tối đa ${collectionSlugLength} ký tự`);
};
/**
 * A product type's page and a product's page share `/products/<slug>`. `own` is the record
 * being updated: the slug it already has is not checked, so a record saved before this rule
 * can still be edited.
 */
async function assertPageSlugFree(
  c: PoolConnection,
  otherTable: "products" | "product_types",
  slug: string | undefined,
  own?: { table: "products" | "product_types"; id: string },
) {
  if (slug === undefined) return;
  if (own) {
    const [[current]] = await c.execute<RowDataPacket[]>(
      `SELECT slug FROM \`${own.table}\` WHERE id=?`,
      [own.id],
    );
    if (current && String(current.slug) === slug) return;
  }
  const [[row]] = await c.execute<RowDataPacket[]>(
    `SELECT 1 FROM \`${otherTable}\` WHERE slug=? LOCK IN SHARE MODE`,
    [slug],
  );
  if (row) throw slugInUse();
}

const legacyAttributeFields = [
  ["dimensions", "dimensions"],
  ["pages", "pages"],
  ["materialVi", "material_vi"],
  ["materialEn", "material_en"],
  ["formatVi", "format_vi"],
  ["formatEn", "format_en"],
  ["occasion", "occasion"],
] as const satisfies readonly (readonly [keyof ProductInput, keyof LegacyAttributeColumns])[];

/**
 * The attributes a write leaves behind, as the JSON and as the legacy columns. `current` is
 * what the product has now; `attributes` in the input replaces it, and a legacy field in the
 * input then decides its own key.
 */
function nextAttributes(current: Attributes, input: Partial<ProductInput>) {
  const base = input.attributes ?? current;
  const columns = legacyFromAttributes(base);
  for (const [field, column] of legacyAttributeFields)
    if (input[field] !== undefined) columns[column] = input[field] || null;
  const attributes: Attributes = { ...base };
  for (const key of legacyAttributeKeys) delete attributes[key];
  return { attributes: { ...attributes, ...attributesFromLegacy(columns) }, columns };
}
const touchesAttributes = (input: Partial<ProductInput>): boolean =>
  input.attributes !== undefined || legacyAttributeFields.some(([f]) => input[f] !== undefined);

function translationsOf(value: unknown): Translations | null {
  if (value == null) return null;
  if (typeof value !== "string") return value as Translations;
  try {
    return JSON.parse(value) as Translations;
  } catch {
    return null;
  }
}

function isReferenced(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (("errno" in error && (error as { errno?: number }).errno === 1451) ||
      ("code" in error && (error as { code?: string }).code === "ER_ROW_IS_REFERENCED_2"))
  );
}

function sortOrder(sort: string | undefined, allowed: Record<string, string>): string {
  const fallback = " ORDER BY `created_at` DESC, `id`";
  if (!sort) return fallback;
  const [key, dir = ""] = sort.split(":");
  const column = allowed[key];
  if (!column) return fallback;
  return ` ORDER BY \`${column}\` ${dir.toLowerCase() === "desc" ? "DESC" : "ASC"}, \`id\``;
}

const categoryDto = (row: RowDataPacket): CategoryDto => ({
  id: String(row.id),
  name: String(row.name),
  slug: String(row.slug),
  description: row.description == null ? null : String(row.description),
  parentId: row.parent_id == null ? null : String(row.parent_id),
  position: Number(row.position),
  active: Boolean(row.active),
  ...("translations" in row
    ? {
        translations: translationsOf(row.translations),
        image: row.image == null ? null : String(row.image),
      }
    : {}),
  createdAt: iso(row.created_at)!,
  updatedAt: iso(row.updated_at)!,
  revision: Number(row.revision),
});
const productTypeDto = (row: RowDataPacket): ProductTypeDto => ({
  id: String(row.id),
  code: String(row.code),
  name: String(row.name),
  slug: String(row.slug),
  description: row.description == null ? null : String(row.description),
  position: Number(row.position),
  active: Boolean(row.active),
  translations: translationsOf(row.translations),
  image: row.image == null ? null : String(row.image),
  createdAt: iso(row.created_at)!,
  updatedAt: iso(row.updated_at)!,
  revision: Number(row.revision),
});
const stockMovementDto = (row: RowDataPacket): StockMovementDto => ({
  id: String(row.id),
  productId: String(row.product_id),
  productName: String(row.product_name),
  delta: Number(row.delta),
  stockBefore: Number(row.stock_before),
  stockAfter: Number(row.stock_after),
  reason: String(row.reason),
  source: String(row.source),
  actorId: row.actor_id == null ? null : String(row.actor_id),
  actorName: row.actor_name == null ? null : String(row.actor_name),
  createdAt: iso(row.created_at)!,
});
const customerDto = (row: RowDataPacket): CustomerDto => ({
  id: String(row.id),
  name: String(row.name),
  kind: String(row.kind),
  address: row.address == null ? null : String(row.address),
  phone: row.phone == null ? null : String(row.phone),
  email: row.email == null ? null : String(row.email),
  vatRate: Number(row.vat_rate),
  notes: row.notes == null ? null : String(row.notes),
  active: Boolean(row.active),
  representative: row.representative == null ? null : String(row.representative),
  extra:
    row.extra == null ? null : typeof row.extra === "string" ? JSON.parse(row.extra) : row.extra,
  createdAt: iso(row.created_at)!,
  updatedAt: iso(row.updated_at)!,
  revision: Number(row.revision),
});
const postDto = (row: RowDataPacket): PostDto => ({
  id: String(row.id),
  slug: String(row.slug),
  title: String(row.title),
  excerpt: row.excerpt == null ? null : String(row.excerpt),
  content: String(row.content),
  categoryId: row.category_id == null ? null : String(row.category_id),
  authorId: String(row.author_id),
  status: String(row.status),
  publishAt: iso(row.publish_at),
  imageId: row.image_id == null ? null : String(row.image_id),
  seoTitle: String(row.seo_title),
  seoDescription: String(row.seo_description),
  readTime: row.read_time == null ? null : String(row.read_time),
  coverImageId: row.cover_image_id == null ? null : String(row.cover_image_id),
  createdAt: iso(row.created_at)!,
  updatedAt: iso(row.updated_at)!,
  revision: Number(row.revision),
});
const productDto = (row: RowDataPacket): ProductDto => ({
  id: String(row.id),
  productCode: String(row.product_code),
  name: String(row.name),
  slug: String(row.slug),
  shortDescription: row.short_description == null ? null : String(row.short_description),
  description: String(row.description),
  productType: String(row.product_type),
  collection: String(row.collection),
  categoryId: row.category_id == null ? null : String(row.category_id),
  price: Number(row.price),
  compareAt: Number(row.compare_at),
  stock: Number(row.stock),
  reserved: Number(row.reserved),
  status: String(row.status),
  imageIds: jsonStrings(row.image_ids),
  tags: jsonStrings(row.tags),
  seoTitle: String(row.seo_title),
  seoDescription: String(row.seo_description),
  nameEn: row.name_en == null ? null : String(row.name_en),
  shortDescriptionEn: row.short_description_en == null ? null : String(row.short_description_en),
  descriptionEn: row.description_en == null ? null : String(row.description_en),
  dimensions: row.dimensions == null ? null : String(row.dimensions),
  pages: row.pages == null ? null : String(row.pages),
  materialVi: row.material_vi == null ? null : String(row.material_vi),
  materialEn: row.material_en == null ? null : String(row.material_en),
  formatVi: row.format_vi == null ? null : String(row.format_vi),
  formatEn: row.format_en == null ? null : String(row.format_en),
  occasion: row.occasion == null ? null : String(row.occasion),
  featured: Boolean(row.featured),
  sortOrder: Number(row.sort_order),
  imageAltVi: row.image_alt_vi == null ? null : String(row.image_alt_vi),
  imageAltEn: row.image_alt_en == null ? null : String(row.image_alt_en),
  attributes: mergeAttributes(row.attributes, row),
  createdAt: iso(row.created_at)!,
  updatedAt: iso(row.updated_at)!,
  revision: Number(row.revision),
});

export function createContentService(pool: Pool, clock: Clock) {
  async function authorized<T>(
    actor: AuthPrincipal,
    code: string,
    work: (c: PoolConnection) => Promise<T>,
  ) {
    return withRbacWrite(pool, async (c) => {
      const { principal } = await lockAuthorizedUsers(c, actor, code, clock);
      assertPermission(principal, code);
      await assertContentReady(c);
      return work(c);
    });
  }
  async function readRow(
    c: PoolConnection,
    table: string,
    id: string,
  ): Promise<RowDataPacket | undefined> {
    const [[row]] = await c.execute<RowDataPacket[]>(`SELECT * FROM \`${table}\` WHERE id=?`, [id]);
    return row;
  }
  async function queryList<T>(
    c: PoolConnection,
    table: string,
    config: { search: string[]; filter: Record<string, string>; sort: Record<string, string> },
    input: ListInput,
    map: (row: RowDataPacket) => T,
  ): Promise<Page<T>> {
    const page = Math.max(1, Math.floor(input.page ?? 1));
    const pageSize = Math.min(500, Math.max(1, Math.floor(input.pageSize ?? 20)));
    const where: string[] = [];
    const params: (string | number)[] = [];
    if (input.search) {
      const term = `%${input.search.replace(/[=%_]/g, (ch) => "=" + ch)}%`;
      where.push(
        "(" + config.search.map((col) => `\`${col}\` LIKE ? ESCAPE '='`).join(" OR ") + ")",
      );
      for (let i = 0; i < config.search.length; i++) params.push(term);
    }
    if (input.filters) {
      for (const [key, value] of Object.entries(input.filters)) {
        const column = config.filter[key];
        if (!column || value === undefined || value === null) continue;
        where.push(`\`${column}\` = ?`);
        params.push(typeof value === "boolean" ? (value ? 1 : 0) : value);
      }
    }
    const predicate = where.length ? ` WHERE ${where.join(" AND ")}` : "";
    const [[count]] = await c.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS n FROM \`${table}\`${predicate}`,
      params,
    );
    const [rows] = await c.execute<RowDataPacket[]>(
      `SELECT * FROM \`${table}\`${predicate}${sortOrder(input.sort, config.sort)} LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize],
    );
    return { items: rows.map(map), total: Number(count.n), page, pageSize };
  }

  /**
   * CRUD for the three flat lists: content categories, product categories (collections)
   * and product types. `products.collection` holds a product category slug and
   * `products.product_type` a product type code, both as plain strings, so the checks a
   * foreign key would do are done here.
   */
  function makeCategory<Input extends CategoryInput | ProductTypeInput, Dto>(
    table: "product_categories" | "content_categories" | "product_types",
    code: "product" | "post",
    targetType: string,
    dto: (row: RowDataPacket) => Dto,
  ) {
    const isType = table === "product_types";
    const localized = table !== "content_categories";
    // The column of `products` that points at this table, and the column it points to.
    const usedBy = isType
      ? (["product_type", "code"] as const)
      : table === "product_categories"
        ? (["collection", "slug"] as const)
        : null;
    return {
      async list(input: ListInput, actor: AuthPrincipal): Promise<Page<Dto>> {
        return authorized(actor, `${code}.view`, (c) =>
          queryList(
            c,
            table,
            {
              search: isType ? ["name", "slug", "code"] : ["name", "slug"],
              filter: isType ? { active: "active" } : { active: "active", parentId: "parent_id" },
              sort: { name: "name", position: "position", createdAt: "created_at" },
            },
            input,
            dto,
          ),
        );
      },
      async get(id: string, actor: AuthPrincipal): Promise<Dto> {
        return authorized(actor, `${code}.view`, async (c) => {
          const row = await readRow(c, table, id);
          if (!row) throw notFound();
          return dto(row);
        });
      },
      async create(input: Input, actor: AuthPrincipal): Promise<Dto> {
        return authorized(actor, `${code}.create`, async (c) => {
          if (isType) await assertPageSlugFree(c, "products", input.slug);
          if (table === "product_categories") assertCollectionSlug(input.slug);
          const id = randomUUID();
          const t = clock.now();
          const columns: Record<string, string | number | Date | null> = {
            id,
            name: input.name,
            slug: input.slug,
            description: input.description ?? null,
            position: input.position ?? 0,
            active: input.active === false ? 0 : 1,
            created_at: t,
            updated_at: t,
            revision: 1,
          };
          if ("code" in input) columns.code = input.code;
          else columns.parent_id = input.parentId ?? null;
          if (localized) {
            columns.translations = input.translations ? JSON.stringify(input.translations) : null;
            columns.image = input.image ?? null;
          }
          const names = Object.keys(columns);
          await c.execute(
            `INSERT INTO \`${table}\` (${names.join(",")}) VALUES (${names.map(() => "?").join(",")})`,
            Object.values(columns),
          );
          await writeAudit(c, {
            actorId: actor.principal.id,
            action: `${targetType}.create`,
            targetType,
            targetId: id,
          });
          return dto((await readRow(c, table, id))!);
        });
      },
      /** A product type's `code` is what products store, so it is never changed here. */
      async update(
        id: string,
        input: Partial<CategoryInput>,
        revision: number,
        actor: AuthPrincipal,
      ): Promise<Dto> {
        return authorized(actor, `${code}.update`, async (c) => {
          if (isType) await assertPageSlugFree(c, "products", input.slug, { table, id });
          const sets: string[] = [];
          const values: (string | number | boolean | null | Date)[] = [];
          for (const [key, col] of [
            ["name", "name"],
            ["slug", "slug"],
            ["description", "description"],
            ...(isType ? [] : ([["parentId", "parent_id"]] as const)),
            ["position", "position"],
            ...(localized ? ([["image", "image"]] as const) : []),
          ] as const) {
            if (input[key] !== undefined) {
              sets.push(`${col}=?`);
              values.push(input[key] ?? null);
            }
          }
          if (input.active !== undefined) {
            sets.push("active=?");
            values.push(input.active ? 1 : 0);
          }
          if (localized && input.translations !== undefined) {
            sets.push("translations=?");
            values.push(input.translations ? JSON.stringify(input.translations) : null);
          }
          // Products follow a collection whose slug changes.
          let previousSlug: string | undefined;
          if (table === "product_categories" && input.slug !== undefined) {
            const [[row]] = await c.execute<RowDataPacket[]>(
              "SELECT slug FROM product_categories WHERE id=? FOR UPDATE",
              [id],
            );
            previousSlug = row && String(row.slug);
            if (input.slug !== previousSlug) assertCollectionSlug(input.slug);
          }
          if (sets.length) {
            const [result] = await c.execute<ResultSetHeader>(
              `UPDATE \`${table}\` SET ${sets.join(",")}, updated_at=?, revision=revision+1 WHERE id=? AND revision=?`,
              [...values, clock.now(), id, revision],
            );
            if (result.affectedRows === 0) throw conflict();
          }
          if (previousSlug !== undefined && input.slug !== previousSlug)
            await c.execute(
              "UPDATE products SET collection=?, updated_at=?, revision=revision+1 WHERE collection=?",
              [input.slug!, clock.now(), previousSlug],
            );
          await writeAudit(c, {
            actorId: actor.principal.id,
            action: `${targetType}.update`,
            targetType,
            targetId: id,
            metadata: { changedFields: Object.keys(input) },
          });
          return dto((await readRow(c, table, id))!);
        });
      },
      async remove(id: string, revision: number, actor: AuthPrincipal): Promise<{ id: string }> {
        return authorized(actor, `${code}.delete`, async (c) => {
          if (usedBy) {
            // Locking reads: a product saved while this runs is either seen here or
            // waits and then fails its own check.
            const [[row]] = await c.execute<RowDataPacket[]>(
              `SELECT \`${usedBy[1]}\` AS value FROM \`${table}\` WHERE id=? FOR UPDATE`,
              [id],
            );
            if (row) {
              const [[used]] = await c.execute<RowDataPacket[]>(
                `SELECT 1 FROM products WHERE \`${usedBy[0]}\`=? LIMIT 1 LOCK IN SHARE MODE`,
                [String(row.value)],
              );
              if (used) throw referenced();
            }
          }
          try {
            const [result] = await c.execute<ResultSetHeader>(
              `DELETE FROM \`${table}\` WHERE id=? AND revision=?`,
              [id, revision],
            );
            if (result.affectedRows === 0) {
              const [[existing]] = await c.execute<RowDataPacket[]>(
                `SELECT id FROM \`${table}\` WHERE id=?`,
                [id],
              );
              if (!existing) throw notFound();
              throw conflict();
            }
          } catch (error) {
            if (isReferenced(error)) throw referenced();
            throw error;
          }
          await writeAudit(c, {
            actorId: actor.principal.id,
            action: `${targetType}.delete`,
            targetType,
            targetId: id,
          });
          return { id };
        });
      },
    };
  }

  async function listCustomers(input: ListInput, actor: AuthPrincipal): Promise<Page<CustomerDto>> {
    return authorized(actor, "customer.view", (c) =>
      queryList(
        c,
        "customers",
        {
          search: ["name", "phone", "email"],
          filter: { kind: "kind", active: "active" },
          sort: { name: "name", kind: "kind", createdAt: "created_at" },
        },
        input,
        customerDto,
      ),
    );
  }
  async function getCustomer(id: string, actor: AuthPrincipal): Promise<CustomerDto> {
    return authorized(actor, "customer.view", async (c) => {
      const row = await readRow(c, "customers", id);
      if (!row) throw notFound();
      return customerDto(row);
    });
  }
  async function insertCustomer(c: PoolConnection, input: CustomerInput): Promise<CustomerDto> {
    const id = randomUUID();
    const t = clock.now();
    await c.execute(
      `INSERT INTO customers (id,name,kind,address,phone,email,vat_rate,notes,active,representative,extra,created_at,updated_at,revision)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
      [
        id,
        input.name,
        input.kind,
        input.address ?? null,
        input.phone ?? null,
        input.email ?? null,
        input.vatRate ?? 8,
        input.notes ?? null,
        input.active === false ? 0 : 1,
        input.representative ?? null,
        input.extra === undefined ? null : JSON.stringify(input.extra),
        t,
        t,
      ],
    );
    return customerDto((await readRow(c, "customers", id))!);
  }
  async function createCustomer(input: CustomerInput, actor: AuthPrincipal): Promise<CustomerDto> {
    return authorized(actor, "customer.create", async (c) => {
      const customer = await insertCustomer(c, input);
      await writeAudit(c, {
        actorId: actor.principal.id,
        action: "customer.create",
        targetType: "customer",
        targetId: customer.id,
      });
      return customer;
    });
  }
  async function changeCustomer(
    c: PoolConnection,
    id: string,
    input: Partial<CustomerInput>,
    revision: number,
  ): Promise<CustomerDto> {
    const sets: string[] = [];
    const values: (string | number | boolean | null | Date)[] = [];
    for (const [key, col] of [
      ["name", "name"],
      ["kind", "kind"],
      ["address", "address"],
      ["phone", "phone"],
      ["email", "email"],
      ["vatRate", "vat_rate"],
      ["notes", "notes"],
      ["representative", "representative"],
    ] as const) {
      if (input[key] !== undefined) {
        sets.push(`${col}=?`);
        values.push(input[key] ?? null);
      }
    }
    if (input.extra !== undefined) {
      sets.push("extra=?");
      values.push(JSON.stringify(input.extra));
    }
    if (input.active !== undefined) {
      sets.push("active=?");
      values.push(input.active ? 1 : 0);
    }
    if (sets.length) {
      const [result] = await c.execute<ResultSetHeader>(
        `UPDATE customers SET ${sets.join(",")}, updated_at=?, revision=revision+1 WHERE id=? AND revision=?`,
        [...values, clock.now(), id, revision],
      );
      if (result.affectedRows === 0) throw conflict();
    }
    return customerDto((await readRow(c, "customers", id))!);
  }
  async function updateCustomer(
    id: string,
    input: Partial<CustomerInput>,
    revision: number,
    actor: AuthPrincipal,
  ): Promise<CustomerDto> {
    return authorized(actor, "customer.update", async (c) => {
      const customer = await changeCustomer(c, id, input, revision);
      await writeAudit(c, {
        actorId: actor.principal.id,
        action: "customer.update",
        targetType: "customer",
        targetId: id,
        metadata: { changedFields: Object.keys(input) },
      });
      return customer;
    });
  }
  async function importCustomers(
    input: { dryRun: boolean; rows: ImportRow[] },
    actor: AuthPrincipal,
  ): Promise<ImportResult> {
    return authorized(actor, "customer.create", async (c) => {
      const { principal } = await lockAuthorizedUsers(c, actor, "customer.view", clock);
      assertPermission(principal, "customer.view");
      if (input.rows.length > 1000)
        throw new ApiError(400, "TOO_MANY_ROWS", "Tối đa 1.000 dòng mỗi lần import");
      if (input.rows.some((row) => row.action === "update")) {
        const { principal } = await lockAuthorizedUsers(c, actor, "customer.update", clock);
        assertPermission(principal, "customer.update");
      }
      const [existing] = await c.query<RowDataPacket[]>(
        "SELECT * FROM customers ORDER BY id FOR UPDATE",
      );
      const customers = existing.map(customerDto);
      const result: ImportResult = {
        rows: [],
        created: 0,
        updated: 0,
        skipped: 0,
        committed: false,
      };
      const prepared: Partial<CustomerInput>[] = [];
      const updateTargets = new Set<string>();
      let stale = false;
      for (const row of input.rows) {
        const parsed = validateImportFields(row.fields, row.action === "update");
        const fields = parsed.success ? parsed.data : row.fields;
        prepared.push(parsed.success ? parsed.data : {});
        const errors =
          parsed.success || row.action === "skip"
            ? []
            : parsed.error.issues.map((issue) => ({
                field: issue.path.join("."),
                message: issue.message,
              }));
        const matches = customers.flatMap((customer) => {
          const by = duplicateKeys(fields, customer);
          return by.length
            ? [{ id: customer.id, name: customer.name, revision: customer.revision, by }]
            : [];
        });
        const earlier = input.rows
          .slice(0, result.rows.length)
          .find((other) => duplicateKeys(fields, other.fields).length);
        if (row.action === "update") {
          const target = customers.find((customer) => customer.id === row.targetId);
          if (!row.targetId || !row.revision || !target) {
            errors.push({
              field: "targetId",
              message: "Khách hàng cập nhật không tồn tại hoặc thiếu revision",
            });
          } else if (target.revision !== row.revision || updateTargets.has(target.id)) {
            stale = true;
            errors.push({ field: "revision", message: "Dữ liệu đã thay đổi, vui lòng tải lại" });
          } else if (!matches.some((match) => match.id === target.id)) {
            errors.push({
              field: "targetId",
              message: "Khách hàng cập nhật không khớp tên, điện thoại hoặc email của dòng",
            });
          }
          if (target) {
            updateTargets.add(target.id);
            const pending = prepared[prepared.length - 1];
            if (pending.extra) {
              pending.extra = { ...target.extra, ...pending.extra };
              if (!customerExtra.safeParse(pending.extra).success)
                errors.push({ field: "extra", message: "Tối đa 30 trường mở rộng" });
            }
          }
        }
        result.rows.push({
          row: row.row,
          status: errors.length ? "error" : matches.length || earlier ? "duplicate" : "ok",
          errors,
          matches,
          ...(earlier ? { inFile: earlier.row } : {}),
        });
      }
      if (input.dryRun) return result;
      if (stale)
        throw new ApiError(409, "REVISION_CONFLICT", "Dữ liệu đã thay đổi, vui lòng tải lại", {
          rows: result.rows,
        });
      if (result.rows.some((row) => row.errors.length))
        throw new ApiError(400, "INVALID_INPUT", "Dữ liệu import không hợp lệ", {
          rows: result.rows,
        });
      const customerIds: string[] = [];
      for (const [index, row] of input.rows.entries()) {
        if (row.action === "skip") {
          result.skipped++;
          continue;
        }
        const fields = prepared[index];
        if (row.action === "create") {
          const customer = await insertCustomer(c, fields as CustomerInput);
          customerIds.push(customer.id);
          result.created++;
        } else {
          const target = customers.find((customer) => customer.id === row.targetId)!;
          const customer = await changeCustomer(c, target.id, fields, row.revision!);
          customerIds.push(customer.id);
          result.updated++;
        }
      }
      await writeAudit(c, {
        actorId: actor.principal.id,
        action: "customer.import",
        targetType: "customer",
        metadata: {
          created: result.created,
          updated: result.updated,
          skipped: result.skipped,
          customerIds,
        },
      });
      result.committed = true;
      return result;
    });
  }
  async function deleteCustomer(
    id: string,
    revision: number,
    actor: AuthPrincipal,
  ): Promise<{ id: string }> {
    return authorized(actor, "customer.delete", async (c) => {
      try {
        const [result] = await c.execute<ResultSetHeader>(
          "DELETE FROM customers WHERE id=? AND revision=?",
          [id, revision],
        );
        if (result.affectedRows === 0) {
          const [[existing]] = await c.execute<RowDataPacket[]>(
            "SELECT id FROM customers WHERE id=?",
            [id],
          );
          if (!existing) throw notFound();
          throw conflict();
        }
      } catch (error) {
        if (isReferenced(error)) throw referenced();
        throw error;
      }
      await writeAudit(c, {
        actorId: actor.principal.id,
        action: "customer.delete",
        targetType: "customer",
        targetId: id,
      });
      return { id };
    });
  }

  async function listPosts(input: ListInput, actor: AuthPrincipal): Promise<Page<PostDto>> {
    return authorized(actor, "post.view", (c) =>
      queryList(
        c,
        "posts",
        {
          search: ["title", "slug", "excerpt"],
          filter: { status: "status", categoryId: "category_id", authorId: "author_id" },
          sort: {
            title: "title",
            status: "status",
            publishAt: "publish_at",
            createdAt: "created_at",
          },
        },
        input,
        postDto,
      ),
    );
  }
  async function getPost(id: string, actor: AuthPrincipal): Promise<PostDto> {
    return authorized(actor, "post.view", async (c) => {
      const row = await readRow(c, "posts", id);
      if (!row) throw notFound();
      return postDto(row);
    });
  }
  async function createPost(input: PostInput, actor: AuthPrincipal): Promise<PostDto> {
    return authorized(actor, "post.create", async (c) => {
      const id = randomUUID();
      const t = clock.now();
      await c.execute(
        `INSERT INTO posts (id,slug,title,excerpt,content,category_id,author_id,status,publish_at,image_id,seo_title,seo_description,read_time,cover_image_id,created_at,updated_at,revision)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
        [
          id,
          input.slug,
          input.title,
          input.excerpt ?? null,
          input.content,
          input.categoryId ?? null,
          input.authorId ?? actor.principal.id,
          input.status ?? "draft",
          toDate(input.publishAt),
          input.imageId ?? null,
          input.seoTitle ?? "",
          input.seoDescription ?? "",
          input.readTime ?? null,
          input.coverImageId ?? null,
          t,
          t,
        ],
      );
      await writeAudit(c, {
        actorId: actor.principal.id,
        action: "post.create",
        targetType: "post",
        targetId: id,
      });
      return postDto((await readRow(c, "posts", id))!);
    });
  }
  async function updatePost(
    id: string,
    input: Partial<PostInput>,
    revision: number,
    actor: AuthPrincipal,
  ): Promise<PostDto> {
    return authorized(actor, "post.update", async (c) => {
      const sets: string[] = [];
      const values: (string | number | boolean | null | Date)[] = [];
      for (const [key, col] of [
        ["slug", "slug"],
        ["title", "title"],
        ["excerpt", "excerpt"],
        ["content", "content"],
        ["categoryId", "category_id"],
        ["authorId", "author_id"],
        ["status", "status"],
        ["imageId", "image_id"],
        ["seoTitle", "seo_title"],
        ["seoDescription", "seo_description"],
        ["readTime", "read_time"],
        ["coverImageId", "cover_image_id"],
      ] as const) {
        if (input[key] !== undefined) {
          sets.push(`${col}=?`);
          values.push(input[key] ?? null);
        }
      }
      if (input.publishAt !== undefined) {
        sets.push("publish_at=?");
        values.push(toDate(input.publishAt));
      }
      if (sets.length) {
        const [result] = await c.execute<ResultSetHeader>(
          `UPDATE posts SET ${sets.join(",")}, updated_at=?, revision=revision+1 WHERE id=? AND revision=?`,
          [...values, clock.now(), id, revision],
        );
        if (result.affectedRows === 0) throw conflict();
      }
      await writeAudit(c, {
        actorId: actor.principal.id,
        action: "post.update",
        targetType: "post",
        targetId: id,
        metadata: { changedFields: Object.keys(input) },
      });
      return postDto((await readRow(c, "posts", id))!);
    });
  }
  async function deletePost(
    id: string,
    revision: number,
    actor: AuthPrincipal,
  ): Promise<{ id: string }> {
    return authorized(actor, "post.delete", async (c) => {
      try {
        const [result] = await c.execute<ResultSetHeader>(
          "DELETE FROM posts WHERE id=? AND revision=?",
          [id, revision],
        );
        if (result.affectedRows === 0) {
          const [[existing]] = await c.execute<RowDataPacket[]>("SELECT id FROM posts WHERE id=?", [
            id,
          ]);
          if (!existing) throw notFound();
          throw conflict();
        }
      } catch (error) {
        if (isReferenced(error)) throw referenced();
        throw error;
      }
      await writeAudit(c, {
        actorId: actor.principal.id,
        action: "post.delete",
        targetType: "post",
        targetId: id,
      });
      return { id };
    });
  }

  async function listProducts(input: ListInput, actor: AuthPrincipal): Promise<Page<ProductDto>> {
    return authorized(actor, "product.view", (c) =>
      queryList(
        c,
        "products",
        {
          search: ["name", "slug", "product_code"],
          filter: {
            status: "status",
            productType: "product_type",
            collection: "collection",
            categoryId: "category_id",
          },
          sort: {
            name: "name",
            price: "price",
            productCode: "product_code",
            createdAt: "created_at",
          },
        },
        input,
        productDto,
      ),
    );
  }
  async function getProduct(id: string, actor: AuthPrincipal): Promise<ProductDto> {
    return authorized(actor, "product.view", async (c) => {
      const row = await readRow(c, "products", id);
      if (!row) throw notFound();
      return productDto(row);
    });
  }
  /** `productType` must be a product type code and `collection` a product category slug. */
  async function assertTaxonomy(c: PoolConnection, input: Partial<ProductInput>) {
    const unknown: string[] = [];
    for (const [field, table, column] of [
      ["productType", "product_types", "code"],
      ["collection", "product_categories", "slug"],
    ] as const) {
      if (input[field] === undefined) continue;
      const [[row]] = await c.execute<RowDataPacket[]>(
        `SELECT 1 FROM \`${table}\` WHERE \`${column}\`=? LOCK IN SHARE MODE`,
        [input[field]],
      );
      if (!row) unknown.push(field);
    }
    if (unknown.length) throw unknownValue(unknown);
  }
  async function createProduct(input: ProductInput, actor: AuthPrincipal): Promise<ProductDto> {
    return authorized(actor, "product.create", async (c) => {
      await assertTaxonomy(c, input);
      await assertPageSlugFree(c, "product_types", input.slug);
      const { attributes, columns } = nextAttributes({}, input);
      const id = randomUUID();
      const t = clock.now();
      await c.execute(
        `INSERT INTO products (id,product_code,name,slug,short_description,description,product_type,collection,category_id,price,compare_at,stock,reserved,status,image_ids,tags,seo_title,seo_description,name_en,short_description_en,description_en,dimensions,pages,material_vi,material_en,format_vi,format_en,occasion,featured,sort_order,image_alt_vi,image_alt_en,created_at,updated_at,revision,attributes)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?)`,
        [
          id,
          input.productCode,
          input.name,
          input.slug,
          input.shortDescription ?? null,
          input.description,
          input.productType,
          input.collection,
          input.categoryId ?? null,
          input.price ?? 0,
          input.compareAt ?? 0,
          input.stock ?? 0,
          input.reserved ?? 0,
          input.status ?? "draft",
          JSON.stringify(input.imageIds ?? []),
          JSON.stringify(input.tags ?? []),
          input.seoTitle ?? "",
          input.seoDescription ?? "",
          input.nameEn ?? null,
          input.shortDescriptionEn ?? null,
          input.descriptionEn ?? null,
          columns.dimensions,
          columns.pages,
          columns.material_vi,
          columns.material_en,
          columns.format_vi,
          columns.format_en,
          columns.occasion,
          input.featured === true ? 1 : 0,
          input.sortOrder ?? 0,
          input.imageAltVi ?? null,
          input.imageAltEn ?? null,
          t,
          t,
          JSON.stringify(attributes),
        ],
      );
      await writeAudit(c, {
        actorId: actor.principal.id,
        action: "product.create",
        targetType: "product",
        targetId: id,
      });
      return productDto((await readRow(c, "products", id))!);
    });
  }
  async function updateProduct(
    id: string,
    input: Partial<ProductInput>,
    revision: number,
    actor: AuthPrincipal,
  ): Promise<ProductDto> {
    return authorized(actor, "product.update", async (c) => {
      let before: RowDataPacket | undefined;
      if (input.stock !== undefined) {
        const [rows] = await c.execute<RowDataPacket[]>(
          "SELECT * FROM products WHERE id=? FOR UPDATE",
          [id],
        );
        before = rows[0];
      }
      await assertTaxonomy(c, input);
      await assertPageSlugFree(c, "product_types", input.slug, { table: "products", id });
      const sets: string[] = [];
      const values: (string | number | boolean | null | Date)[] = [];
      if (touchesAttributes(input)) {
        const [[row]] = await c.execute<RowDataPacket[]>(
          "SELECT * FROM products WHERE id=? FOR UPDATE",
          [id],
        );
        if (row) {
          const { attributes, columns } = nextAttributes(
            mergeAttributes(row.attributes, row),
            input,
          );
          for (const [column, value] of Object.entries(columns)) {
            sets.push(`${column}=?`);
            values.push(value);
          }
          sets.push("attributes=?");
          values.push(JSON.stringify(attributes));
        }
      }
      for (const [key, col] of [
        ["productCode", "product_code"],
        ["name", "name"],
        ["slug", "slug"],
        ["shortDescription", "short_description"],
        ["description", "description"],
        ["productType", "product_type"],
        ["collection", "collection"],
        ["categoryId", "category_id"],
        ["price", "price"],
        ["compareAt", "compare_at"],
        ["stock", "stock"],
        ["reserved", "reserved"],
        ["status", "status"],
        ["seoTitle", "seo_title"],
        ["seoDescription", "seo_description"],
        ["nameEn", "name_en"],
        ["shortDescriptionEn", "short_description_en"],
        ["descriptionEn", "description_en"],
        ["sortOrder", "sort_order"],
        ["imageAltVi", "image_alt_vi"],
        ["imageAltEn", "image_alt_en"],
      ] as const) {
        if (input[key] !== undefined) {
          sets.push(`${col}=?`);
          values.push(input[key] ?? null);
        }
      }
      if (input.featured !== undefined) {
        sets.push("featured=?");
        values.push(input.featured ? 1 : 0);
      }
      if (input.imageIds !== undefined) {
        sets.push("image_ids=?");
        values.push(JSON.stringify(input.imageIds));
      }
      if (input.tags !== undefined) {
        sets.push("tags=?");
        values.push(JSON.stringify(input.tags));
      }
      if (sets.length) {
        const [result] = await c.execute<ResultSetHeader>(
          `UPDATE products SET ${sets.join(",")}, updated_at=?, revision=revision+1 WHERE id=? AND revision=?`,
          [...values, clock.now(), id, revision],
        );
        if (result.affectedRows === 0) throw conflict();
      }
      const product = productDto((await readRow(c, "products", id))!);
      if (before && Number(before.stock) !== product.stock)
        await writeStockMovement(
          c,
          product,
          Number(before.stock),
          "Cập nhật sản phẩm",
          "product_edit",
          actor,
        );
      await writeAudit(c, {
        actorId: actor.principal.id,
        action: "product.update",
        targetType: "product",
        targetId: id,
        metadata: { changedFields: Object.keys(input) },
      });
      return product;
    });
  }
  async function writeStockMovement(
    c: PoolConnection,
    product: ProductDto,
    stockBefore: number,
    reason: string,
    source: "manual" | "product_edit",
    actor: AuthPrincipal,
  ): Promise<void> {
    await c.execute(
      `INSERT INTO stock_movements
       (id,product_id,product_name,delta,stock_before,stock_after,reason,source,actor_id,actor_name,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        randomUUID(),
        product.id,
        product.name,
        product.stock - stockBefore,
        stockBefore,
        product.stock,
        reason,
        source,
        actor.principal.id,
        actor.principal.displayName,
        clock.now(),
      ],
    );
  }
  async function adjustStock(
    id: string,
    input: { revision: number; delta: number; reason: string },
    actor: AuthPrincipal,
  ): Promise<ProductDto> {
    return authorized(actor, "product.update", async (c) => {
      if (
        !Number.isInteger(input.delta) ||
        input.delta === 0 ||
        input.delta < -2147483648 ||
        input.delta > 2147483647 ||
        !input.reason.trim() ||
        input.reason.trim().length > 500
      )
        throw new ApiError(400, "INVALID_INPUT", "Điều chỉnh tồn kho không hợp lệ");
      const [[row]] = await c.execute<RowDataPacket[]>(
        "SELECT * FROM products WHERE id=? FOR UPDATE",
        [id],
      );
      if (!row) throw notFound();
      if (Number(row.revision) !== input.revision) throw conflict();
      const stockAfter = Number(row.stock) + input.delta;
      if (stockAfter < 0 || stockAfter < Number(row.reserved))
        throw new ApiError(
          400,
          "STOCK_BELOW_RESERVED",
          "Tồn kho không được âm hoặc nhỏ hơn số lượng đã giữ",
        );
      if (stockAfter > 2147483647)
        throw new ApiError(400, "INVALID_INPUT", "Số lượng tồn kho quá lớn");
      const [result] = await c.execute<ResultSetHeader>(
        "UPDATE products SET stock=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?",
        [stockAfter, clock.now(), id, input.revision],
      );
      if (result.affectedRows !== 1) throw conflict();
      const product = productDto((await readRow(c, "products", id))!);
      await writeStockMovement(c, product, Number(row.stock), input.reason.trim(), "manual", actor);
      await writeAudit(c, {
        actorId: actor.principal.id,
        action: "product.stock_adjust",
        targetType: "product",
        targetId: id,
      });
      return product;
    });
  }
  async function listStockMovements(
    input: ListInput & { productId?: string },
    actor: AuthPrincipal,
  ): Promise<Page<StockMovementDto>> {
    return authorized(actor, "product.view", (c) =>
      queryList(
        c,
        "stock_movements",
        { search: [], filter: { productId: "product_id" }, sort: {} },
        { page: input.page, pageSize: input.pageSize, filters: { productId: input.productId } },
        stockMovementDto,
      ),
    );
  }
  async function deleteProduct(
    id: string,
    revision: number,
    actor: AuthPrincipal,
  ): Promise<{ id: string }> {
    return authorized(actor, "product.delete", async (c) => {
      try {
        const [result] = await c.execute<ResultSetHeader>(
          "DELETE FROM products WHERE id=? AND revision=?",
          [id, revision],
        );
        if (result.affectedRows === 0) {
          const [[existing]] = await c.execute<RowDataPacket[]>(
            "SELECT id FROM products WHERE id=?",
            [id],
          );
          if (!existing) throw notFound();
          throw conflict();
        }
      } catch (error) {
        if (isReferenced(error)) throw referenced();
        throw error;
      }
      await writeAudit(c, {
        actorId: actor.principal.id,
        action: "product.delete",
        targetType: "product",
        targetId: id,
      });
      return { id };
    });
  }

  const productCategories = makeCategory<CategoryInput, CategoryDto>(
    "product_categories",
    "product",
    "product_category",
    categoryDto,
  );
  const contentCategories = makeCategory<CategoryInput, CategoryDto>(
    "content_categories",
    "post",
    "content_category",
    categoryDto,
  );
  const productTypes = makeCategory<ProductTypeInput, ProductTypeDto>(
    "product_types",
    "product",
    "product_type",
    productTypeDto,
  );

  return {
    listCustomers,
    importCustomers,
    getCustomer,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    listPosts,
    getPost,
    createPost,
    updatePost,
    deletePost,
    listProducts,
    getProduct,
    createProduct,
    updateProduct,
    adjustStock,
    listStockMovements,
    deleteProduct,
    listProductCategories: productCategories.list,
    getProductCategory: productCategories.get,
    createProductCategory: productCategories.create,
    updateProductCategory: productCategories.update,
    deleteProductCategory: productCategories.remove,
    listContentCategories: contentCategories.list,
    getContentCategory: contentCategories.get,
    createContentCategory: contentCategories.create,
    updateContentCategory: contentCategories.update,
    deleteContentCategory: contentCategories.remove,
    listProductTypes: productTypes.list,
    getProductType: productTypes.get,
    createProductType: productTypes.create,
    updateProductType: productTypes.update,
    deleteProductType: productTypes.remove,
  };
}
export type ContentService = ReturnType<typeof createContentService>;
