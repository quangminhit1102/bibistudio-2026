import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from "mysql2/promise";

export interface SeedCategory {
  slug: string;
  name: string;
  description?: string | null;
  position?: number;
}
export interface SeedPost {
  slug: string;
  title: string;
  excerpt?: string | null;
  content: string;
  categorySlug?: string | null;
  status?: string;
  publishAt?: string | Date | null;
  imageId?: string | null;
  seoTitle?: string;
  seoDescription?: string;
  readTime?: string | null;
  coverImageId?: string | null;
}
export interface SeedProduct {
  productCode: string;
  name: string;
  slug: string;
  shortDescription?: string | null;
  description: string;
  productType: string;
  collection: string;
  categorySlug?: string | null;
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
export interface ContentSeedData {
  posts: SeedPost[];
  products: SeedProduct[];
  productCategories: SeedCategory[];
  contentCategories: SeedCategory[];
}

/** Ruling 2: posts.author_id is NOT NULL and FK → users; seed a stable system author. */
export const SYSTEM_AUTHOR_ID = "author-bibi-studio";

const toDate = (value: string | Date | null | undefined): Date | null =>
  value == null ? null : value instanceof Date ? value : new Date(value);

/**
 * The admin editor stores rich content in the `html-v1` envelope
 * (`writeRichContent` in `src/features/admin/content/rich-content.ts`). Seeding raw HTML
 * would render as escaped literal text in the editor and corrupt on save; store the
 * envelope instead so seeded posts round-trip through `readRichContent`/`writeRichContent`.
 */
const richEnvelope = (html: string): string => JSON.stringify({ format: "html-v1", html });

async function upsertCategory(
  c: PoolConnection,
  table: "content_categories" | "product_categories",
  cat: SeedCategory,
  now: Date,
): Promise<{ id: string; fresh: boolean }> {
  const id = randomUUID();
  const [result] = await c.execute<ResultSetHeader>(
    `INSERT INTO \`${table}\` (id,name,slug,description,parent_id,position,active,created_at,updated_at,revision)
     VALUES (?,?,?,?,NULL,?,1,?,?,1)
     ON DUPLICATE KEY UPDATE id=id`,
    [id, cat.name, cat.slug, cat.description ?? null, cat.position ?? 0, now, now],
  );
  const [[row]] = await c.execute<RowDataPacket[]>(`SELECT id FROM \`${table}\` WHERE slug=?`, [
    cat.slug,
  ]);
  return { id: String(row.id), fresh: result.affectedRows === 1 };
}

/** Idempotent one-shot seed. Inserts posts/products only when `posts` is empty. */
export async function seedContent(pool: Pool, data: ContentSeedData): Promise<number> {
  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    const [[{ n }]] = await c.query<RowDataPacket[]>("SELECT COUNT(*) n FROM posts");
    if (n > 0) {
      await c.commit();
      return 0;
    }
    const now = new Date();
    let inserted = 0;
    await c.execute(
      `INSERT INTO users (id,username,display_name,password_hash,active,is_master,deleted_at)
       VALUES (?,?,?,?,1,NULL,?)
       ON DUPLICATE KEY UPDATE active=1`,
      [SYSTEM_AUTHOR_ID, SYSTEM_AUTHOR_ID, "BiBi Studio", "!", now],
    );
    const contentCategoryIds = new Map<string, string>();
    for (const cat of data.contentCategories ?? []) {
      const { id, fresh } = await upsertCategory(c, "content_categories", cat, now);
      contentCategoryIds.set(cat.slug, id);
      if (fresh) inserted++;
    }
    const productCategoryIds = new Map<string, string>();
    for (const cat of data.productCategories ?? []) {
      const { id, fresh } = await upsertCategory(c, "product_categories", cat, now);
      productCategoryIds.set(cat.slug, id);
      if (fresh) inserted++;
    }
    for (const post of data.posts ?? []) {
      await c.execute(
        `INSERT INTO posts (id,slug,title,excerpt,content,category_id,author_id,status,publish_at,image_id,seo_title,seo_description,read_time,cover_image_id,created_at,updated_at,revision)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
        [
          "journal-" + post.slug,
          post.slug,
          post.title,
          post.excerpt ?? null,
          richEnvelope(post.content),
          post.categorySlug ? (contentCategoryIds.get(post.categorySlug) ?? null) : null,
          SYSTEM_AUTHOR_ID,
          post.status ?? "published",
          toDate(post.publishAt),
          post.imageId ?? null,
          post.seoTitle ?? "",
          post.seoDescription ?? "",
          post.readTime ?? null,
          post.coverImageId ?? null,
          now,
          now,
        ],
      );
      inserted++;
    }
    for (const product of data.products ?? []) {
      await c.execute(
        `INSERT INTO products (id,product_code,name,slug,short_description,description,product_type,collection,category_id,price,compare_at,stock,reserved,status,image_ids,tags,seo_title,seo_description,name_en,short_description_en,description_en,dimensions,pages,material_vi,material_en,format_vi,format_en,occasion,featured,sort_order,image_alt_vi,image_alt_en,created_at,updated_at,revision)
         VALUES (?,?,?,?,?,?,?,?,?,0,0,0,0,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
        [
          randomUUID(),
          product.productCode,
          product.name,
          product.slug,
          product.shortDescription ?? null,
          product.description,
          product.productType,
          product.collection,
          product.categorySlug ? (productCategoryIds.get(product.categorySlug) ?? null) : null,
          product.status ?? "published",
          JSON.stringify(product.imageIds ?? []),
          JSON.stringify(product.tags ?? []),
          product.seoTitle ?? "",
          product.seoDescription ?? "",
          product.nameEn ?? null,
          product.shortDescriptionEn ?? null,
          product.descriptionEn ?? null,
          product.dimensions ?? null,
          product.pages ?? null,
          product.materialVi ?? null,
          product.materialEn ?? null,
          product.formatVi ?? null,
          product.formatEn ?? null,
          product.occasion ?? null,
          product.featured === true ? 1 : 0,
          product.sortOrder ?? 0,
          product.imageAltVi ?? null,
          product.imageAltEn ?? null,
          now,
          now,
        ],
      );
      inserted++;
    }
    await c.commit();
    return inserted;
  } catch (error) {
    await c.rollback();
    throw error;
  } finally {
    c.release();
  }
}
