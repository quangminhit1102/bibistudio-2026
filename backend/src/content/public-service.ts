import type { Pool, RowDataPacket } from "mysql2/promise";

const imageIds = (value: unknown): string[] => {
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

export function createContentPublicService(pool: Pool) {
  return {
    async listPosts() {
      const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT id,slug,title,excerpt,seo_title,seo_description,category_id,author_id,publish_at,content FROM posts WHERE status='published' ORDER BY publish_at DESC",
      );
      return rows;
    },
    async getPost(slug: string) {
      const [[row]] = await pool.query<RowDataPacket[]>(
        "SELECT id,slug,title,excerpt,seo_title,seo_description,category_id,author_id,publish_at,content FROM posts WHERE slug=? AND status='published'",
        [slug],
      );
      return row ?? null;
    },
    async listProducts() {
      const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT id,name,slug,short_description,description,product_type,collection,price,compare_at,image_ids,seo_title,seo_description FROM products WHERE status='published' ORDER BY name",
      );
      return rows.map((row) => ({ ...row, image_ids: imageIds(row.image_ids) }));
    },
    async getProduct(slug: string) {
      const [[row]] = await pool.query<RowDataPacket[]>(
        "SELECT id,name,slug,short_description,description,product_type,collection,price,compare_at,image_ids,seo_title,seo_description FROM products WHERE slug=? AND status='published'",
        [slug],
      );
      return row ? { ...row, image_ids: imageIds(row.image_ids) } : null;
    },
    async listCategories(scope: string) {
      const table = scope === "content" ? "content_categories" : "product_categories";
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT name,slug,parent_id,position FROM \`${table}\` ORDER BY position`,
      );
      return rows;
    },
  };
}
