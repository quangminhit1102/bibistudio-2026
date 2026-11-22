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

export interface CategoryInput {
  name: string;
  slug: string;
  description?: string | null;
  parentId?: string | null;
  position?: number;
  active?: boolean;
}
export interface CategoryDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  position: number;
  active: boolean;
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
  createdAt: iso(row.created_at)!,
  updatedAt: iso(row.updated_at)!,
  revision: Number(row.revision),
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

  function makeCategory(
    table: "product_categories" | "content_categories",
    code: "product" | "post",
    targetType: string,
  ) {
    return {
      async list(input: ListInput, actor: AuthPrincipal): Promise<Page<CategoryDto>> {
        return authorized(actor, `${code}.view`, (c) =>
          queryList(
            c,
            table,
            {
              search: ["name", "slug"],
              filter: { active: "active", parentId: "parent_id" },
              sort: { name: "name", position: "position", createdAt: "created_at" },
            },
            input,
            categoryDto,
          ),
        );
      },
      async get(id: string, actor: AuthPrincipal): Promise<CategoryDto> {
        return authorized(actor, `${code}.view`, async (c) => {
          const row = await readRow(c, table, id);
          if (!row) throw notFound();
          return categoryDto(row);
        });
      },
      async create(input: CategoryInput, actor: AuthPrincipal): Promise<CategoryDto> {
        return authorized(actor, `${code}.create`, async (c) => {
          const id = randomUUID();
          const t = clock.now();
          await c.execute(
            `INSERT INTO \`${table}\` (id,name,slug,description,parent_id,position,active,created_at,updated_at,revision)
             VALUES (?,?,?,?,?,?,?,?,?,1)`,
            [
              id,
              input.name,
              input.slug,
              input.description ?? null,
              input.parentId ?? null,
              input.position ?? 0,
              input.active === false ? 0 : 1,
              t,
              t,
            ],
          );
          await writeAudit(c, {
            actorId: actor.principal.id,
            action: `${targetType}.create`,
            targetType,
            targetId: id,
          });
          return categoryDto((await readRow(c, table, id))!);
        });
      },
      async update(
        id: string,
        input: Partial<CategoryInput>,
        revision: number,
        actor: AuthPrincipal,
      ): Promise<CategoryDto> {
        return authorized(actor, `${code}.update`, async (c) => {
          const sets: string[] = [];
          const values: (string | number | boolean | null | Date)[] = [];
          for (const [key, col] of [
            ["name", "name"],
            ["slug", "slug"],
            ["description", "description"],
            ["parentId", "parent_id"],
            ["position", "position"],
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
          if (sets.length) {
            const [result] = await c.execute<ResultSetHeader>(
              `UPDATE \`${table}\` SET ${sets.join(",")}, updated_at=?, revision=revision+1 WHERE id=? AND revision=?`,
              [...values, clock.now(), id, revision],
            );
            if (result.affectedRows === 0) throw conflict();
          }
          await writeAudit(c, {
            actorId: actor.principal.id,
            action: `${targetType}.update`,
            targetType,
            targetId: id,
            metadata: { changedFields: Object.keys(input) },
          });
          return categoryDto((await readRow(c, table, id))!);
        });
      },
      async remove(id: string, revision: number, actor: AuthPrincipal): Promise<{ id: string }> {
        return authorized(actor, `${code}.delete`, async (c) => {
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
  async function createCustomer(input: CustomerInput, actor: AuthPrincipal): Promise<CustomerDto> {
    return authorized(actor, "customer.create", async (c) => {
      const id = randomUUID();
      const t = clock.now();
      await c.execute(
        `INSERT INTO customers (id,name,kind,address,phone,email,vat_rate,notes,active,created_at,updated_at,revision)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,1)`,
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
          t,
          t,
        ],
      );
      await writeAudit(c, {
        actorId: actor.principal.id,
        action: "customer.create",
        targetType: "customer",
        targetId: id,
      });
      return customerDto((await readRow(c, "customers", id))!);
    });
  }
  async function updateCustomer(
    id: string,
    input: Partial<CustomerInput>,
    revision: number,
    actor: AuthPrincipal,
  ): Promise<CustomerDto> {
    return authorized(actor, "customer.update", async (c) => {
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
      if (sets.length) {
        const [result] = await c.execute<ResultSetHeader>(
          `UPDATE customers SET ${sets.join(",")}, updated_at=?, revision=revision+1 WHERE id=? AND revision=?`,
          [...values, clock.now(), id, revision],
        );
        if (result.affectedRows === 0) throw conflict();
      }
      await writeAudit(c, {
        actorId: actor.principal.id,
        action: "customer.update",
        targetType: "customer",
        targetId: id,
        metadata: { changedFields: Object.keys(input) },
      });
      return customerDto((await readRow(c, "customers", id))!);
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
  async function createProduct(input: ProductInput, actor: AuthPrincipal): Promise<ProductDto> {
    return authorized(actor, "product.create", async (c) => {
      const id = randomUUID();
      const t = clock.now();
      await c.execute(
        `INSERT INTO products (id,product_code,name,slug,short_description,description,product_type,collection,category_id,price,compare_at,stock,reserved,status,image_ids,tags,seo_title,seo_description,name_en,short_description_en,description_en,dimensions,pages,material_vi,material_en,format_vi,format_en,occasion,featured,sort_order,image_alt_vi,image_alt_en,created_at,updated_at,revision)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
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
          input.dimensions ?? null,
          input.pages ?? null,
          input.materialVi ?? null,
          input.materialEn ?? null,
          input.formatVi ?? null,
          input.formatEn ?? null,
          input.occasion ?? null,
          input.featured === true ? 1 : 0,
          input.sortOrder ?? 0,
          input.imageAltVi ?? null,
          input.imageAltEn ?? null,
          t,
          t,
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
      const sets: string[] = [];
      const values: (string | number | boolean | null | Date)[] = [];
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
        ["dimensions", "dimensions"],
        ["pages", "pages"],
        ["materialVi", "material_vi"],
        ["materialEn", "material_en"],
        ["formatVi", "format_vi"],
        ["formatEn", "format_en"],
        ["occasion", "occasion"],
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
      await writeAudit(c, {
        actorId: actor.principal.id,
        action: "product.update",
        targetType: "product",
        targetId: id,
        metadata: { changedFields: Object.keys(input) },
      });
      return productDto((await readRow(c, "products", id))!);
    });
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

  const productCategories = makeCategory("product_categories", "product", "product_category");
  const contentCategories = makeCategory("content_categories", "post", "content_category");

  return {
    listCustomers,
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
  };
}
export type ContentService = ReturnType<typeof createContentService>;
