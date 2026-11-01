import { z } from "zod";
import type { AdminModels, AdminTransaction, EntityKey } from "./contracts";
import { ServiceError } from "./errors";
const name = z.string().trim().min(1, "Vui lòng nhập tên").max(200);
const amount = z.number().int().min(0, "Giá trị không được âm");
const catalogue = z
  .object({
    name,
    slug: name,
    price: amount,
    stock: amount,
    reserved: amount,
    status: z.enum(["draft", "published", "hidden"]),
    imageIds: z.array(z.string()).max(10),
    tags: z.array(z.string()),
    seoTitle: z.string().max(100),
    seoDescription: z.string().max(320),
  })
  .passthrough();
export const schemas = {
  products: catalogue.extend({
    sku: name,
    productType: name,
    collection: name,
    categoryId: z.string(),
    shortDescription: z.string(),
    compareAt: amount,
  }),
  books: catalogue.extend({
    isbn: name,
    authorIds: z.array(z.string()).min(1),
    publisherId: name,
    genreIds: z.array(z.string()),
    year: z.number().int().min(1000).max(2100),
    language: name,
  }),
  categories: z
    .object({
      name,
      slug: name,
      parentId: z.string().nullable(),
      kind: z.enum(["product", "content", "genre"]),
      position: amount,
      active: z.boolean(),
    })
    .passthrough(),
  authors: z.object({ name }).passthrough(),
  publishers: z
    .object({ name, email: z.union([z.literal(""), z.string().email()]).optional() })
    .passthrough(),
  users: z
    .object({ name, email: z.string().email(), roleId: name, active: z.boolean() })
    .passthrough(),
  roles: z
    .object({
      name,
      permissions: z.record(
        z.array(z.enum(["view", "create", "update", "delete", "export", "settings"])),
      ),
    })
    .passthrough(),
  posts: z
    .object({
      title: name,
      slug: name,
      excerpt: z.string().max(1000),
      content: z.string(),
      authorId: name,
      categoryId: z.string(),
      tagIds: z.array(z.string()),
      status: z.enum(["draft", "published"]),
      publishAt: z.string().nullable(),
      imageId: z.string().nullable(),
      seoTitle: z.string().max(100),
      seoDescription: z.string().max(320),
    })
    .passthrough(),
  tags: z.object({ name }).passthrough(),
};
export async function validateRecord<K extends EntityKey>(
  entity: K,
  row: AdminModels[K],
  tx: AdminTransaction,
  old?: AdminModels[K],
) {
  const schema = schemas[entity as keyof typeof schemas];
  if (schema) {
    const result = schema.safeParse(row);
    if (!result.success)
      throw new ServiceError(
        "validation",
        result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      );
  }
  const records = await tx.list(entity);
  for (const field of ["sku", "slug", "isbn", "email"]) {
    const value = (row as unknown as Record<string, unknown>)[field];
    if (
      value &&
      records.some(
        (r) => r.id !== row.id && (r as unknown as Record<string, unknown>)[field] === value,
      )
    )
      throw new ServiceError("validation", `${field} đã tồn tại.`);
  }
  if (entity === "categories") {
    const c = row as AdminModels["categories"];
    const all = await tx.list("categories");
    let parent = c.parentId;
    const seen = new Set([c.id]);
    while (parent) {
      if (seen.has(parent))
        throw new ServiceError("validation", "Danh mục không được chứa vòng lặp.");
      seen.add(parent);
      const p = all.find((r) => r.id === parent);
      if (!p || p.kind !== c.kind)
        throw new ServiceError("validation", "Danh mục cha không hợp lệ.");
      parent = p.parentId;
    }
  }
  if (entity === "users") {
    const user = row as AdminModels["users"];
    if (
      !(await tx.get("roles", user.roleId)) &&
      !["super-admin", "administrator", "manager", "editor", "viewer"].includes(user.roleId)
    )
      throw new ServiceError("validation", "Vai trò không tồn tại.");
    const before = old as AdminModels["users"] | undefined;
    if (
      before?.roleId === "super-admin" &&
      before.active &&
      (user.roleId !== "super-admin" || !user.active)
    ) {
      const others = (await tx.list("users")).filter(
        (u) => u.id !== user.id && u.active && u.roleId === "super-admin",
      );
      if (!others.length)
        throw new ServiceError("validation", "Không thể hạ quyền Super Admin cuối cùng.");
    }
  }
  if (entity === "books") {
    const b = row as AdminModels["books"];
    for (const id of b.authorIds)
      if (!(await tx.get("authors", id)))
        throw new ServiceError("validation", "Tác giả không tồn tại.");
    if (!(await tx.get("publishers", b.publisherId)))
      throw new ServiceError("validation", "Nhà xuất bản không tồn tại.");
  }
  if (entity === "products" || entity === "books") {
    const p = row as AdminModels["products"];
    if (p.reserved > p.stock)
      throw new ServiceError("validation", "Tồn kho không thể thấp hơn lượng đã giữ.");
  }
}
export async function assertDeletable(entity: EntityKey, id: string, tx: AdminTransaction) {
  const used = (
    await Promise.all(
      ["books", "products", "posts", "categories", "users", "orders"].map((e) =>
        tx.list(e as EntityKey),
      ),
    )
  ).flat();
  const referenceFields = [
    "authorIds",
    "publisherId",
    "genreIds",
    "categoryId",
    "parentId",
    "roleId",
    "authorId",
    "tagIds",
    "imageIds",
    "imageId",
  ];
  for (const row of used) {
    if (entity === "users" && row.id === id) continue;
    const value = row as unknown as Record<string, unknown>;
    for (const field of referenceFields) {
      const v = value[field];
      if (v === id || (Array.isArray(v) && v.includes(id)))
        throw new ServiceError(
          "validation",
          "Dữ liệu đang được sử dụng. Hãy chuyển liên kết trước khi xóa.",
        );
    }
  }
  if (entity === "products" || entity === "books")
    for (const o of await tx.list("orders"))
      if (o.items.some((i) => i.id === id && i.entity === entity))
        throw new ServiceError("validation", "Sản phẩm có lịch sử đơn hàng; hãy ẩn thay vì xóa.");
  if (entity === "users") {
    const u = await tx.get("users", id);
    if (
      u?.roleId === "super-admin" &&
      (await tx.list("users")).filter((r) => r.active && r.roleId === "super-admin").length <= 1
    )
      throw new ServiceError("validation", "Không thể xóa Super Admin cuối cùng.");
  }
}
