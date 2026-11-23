import type { Pool, RowDataPacket } from "mysql2/promise";
import type { Clock } from "../config";
import { mergeAttributes } from "./legacy-attributes";

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

const resolveImage = (value: string): string =>
  value.startsWith("/") || value.startsWith("http") ? value : `/api/media/${value}`;

// `{ "<locale>": { name, plural?, tagline?, intro? } }`; a row without any reads as `{}`.
const translations = (value: unknown): Record<string, Record<string, string>> => {
  let parsed = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return {};
    }
  }
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, Record<string, string>>)
    : {};
};

const str = (value: unknown): string => (value == null ? "" : String(value));
const nullable = (value: unknown): string | null => (value == null ? null : String(value));

// A published post is public only once its publish time has passed.
const LIVE_POST = "p.status='published' AND (p.publish_at IS NULL OR p.publish_at <= ?)";

// Lists are read whole by the public pages. The cap bounds what one anonymous request can
// make the database and the response carry until the lists are paginated.
export const PUBLIC_LIST_LIMIT = 500;

export function createContentPublicService(pool: Pool, clock: Clock) {
  const postSummary = (row: RowDataPacket) => {
    const coverRef = row.cover_image_id ?? row.image_id;
    return {
      slug: String(row.slug),
      title: String(row.title),
      excerpt: nullable(row.excerpt),
      category_name: nullable(row.category_name),
      author_name: nullable(row.author_name),
      publish_at: nullable(row.publish_at),
      read_time: nullable(row.read_time),
      cover_url: coverRef == null ? null : resolveImage(String(coverRef)),
      seo_title: str(row.seo_title),
      seo_description: str(row.seo_description),
    };
  };
  const postShape = (row: RowDataPacket) => ({ ...postSummary(row), content: str(row.content) });
  const productShape = (row: RowDataPacket) => ({
    slug: String(row.slug),
    name: { vi: str(row.name), en: str(row.name_en) },
    description: { vi: str(row.description), en: str(row.description_en) },
    short_description: nullable(row.short_description),
    product_type: String(row.product_type),
    collection: String(row.collection),
    price: Number(row.price),
    compare_at: Number(row.compare_at),
    images: imageIds(row.image_ids).map(resolveImage),
    image_alt: { vi: str(row.image_alt_vi), en: str(row.image_alt_en) },
    dimensions: nullable(row.dimensions),
    pages: nullable(row.pages),
    material: { vi: str(row.material_vi), en: str(row.material_en) },
    format: { vi: str(row.format_vi), en: str(row.format_en) },
    occasion: nullable(row.occasion),
    featured: Boolean(row.featured),
    sort_order: Number(row.sort_order),
    seo_title: str(row.seo_title),
    seo_description: str(row.seo_description),
    // Every attribute by the site's key; the fields above stay for older pages.
    attributes: mergeAttributes(row.attributes, row),
  });
  const taxonomyShape = (row: RowDataPacket) => ({
    slug: String(row.slug),
    name: String(row.name),
    tagline: nullable(row.description) ?? "",
    translations: translations(row.translations),
    image: row.image == null || row.image === "" ? null : resolveImage(String(row.image)),
  });

  return {
    async listPosts() {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT p.id,p.slug,p.title,p.excerpt,p.seo_title,p.seo_description,p.publish_at,p.read_time,p.image_id,p.cover_image_id,
                c.name AS category_name,u.display_name AS author_name
         FROM posts p
         LEFT JOIN content_categories c ON c.id=p.category_id
         LEFT JOIN users u ON u.id=p.author_id
         WHERE ${LIVE_POST}
         ORDER BY p.publish_at DESC, p.slug
         LIMIT ?`,
        [clock.now(), PUBLIC_LIST_LIMIT],
      );
      return rows.map(postSummary);
    },
    async getPost(slug: string) {
      const [[row]] = await pool.query<RowDataPacket[]>(
        `SELECT p.id,p.slug,p.title,p.excerpt,p.content,p.seo_title,p.seo_description,p.publish_at,p.read_time,p.image_id,p.cover_image_id,
                c.name AS category_name,u.display_name AS author_name
         FROM posts p
         LEFT JOIN content_categories c ON c.id=p.category_id
         LEFT JOIN users u ON u.id=p.author_id
         WHERE p.slug=? AND ${LIVE_POST}`,
        [slug, clock.now()],
      );
      return row ? postShape(row) : null;
    },
    async listProducts() {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id,name,slug,short_description,description,product_type,collection,price,compare_at,image_ids,seo_title,seo_description,
                name_en,short_description_en,description_en,dimensions,pages,material_vi,material_en,format_vi,format_en,occasion,featured,sort_order,image_alt_vi,image_alt_en,attributes
         FROM products WHERE status='published' ORDER BY sort_order, name, slug
         LIMIT ?`,
        [PUBLIC_LIST_LIMIT],
      );
      return rows.map(productShape);
    },
    async getProduct(slug: string) {
      const [[row]] = await pool.query<RowDataPacket[]>(
        `SELECT id,name,slug,short_description,description,product_type,collection,price,compare_at,image_ids,seo_title,seo_description,
                name_en,short_description_en,description_en,dimensions,pages,material_vi,material_en,format_vi,format_en,occasion,featured,sort_order,image_alt_vi,image_alt_en,attributes
         FROM products WHERE slug=? AND status='published'`,
        [slug],
      );
      return row ? productShape(row) : null;
    },
    async listCategories(scope: string) {
      const table = scope === "content" ? "content_categories" : "product_categories";
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT name,slug,parent_id,position FROM \`${table}\` ORDER BY position`,
      );
      return rows;
    },
    async listCollections() {
      const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT name,slug,description,translations,image FROM product_categories WHERE active=1 ORDER BY position, name",
      );
      return rows.map(taxonomyShape);
    },
    /** `code` is what a product's `product_type` holds; `slug` is the URL segment. */
    async listProductTypes() {
      const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT code,name,slug,description,translations,image FROM product_types WHERE active=1 ORDER BY position, name",
      );
      return rows.map((row) => ({ code: String(row.code), ...taxonomyShape(row) }));
    },
  };
}
