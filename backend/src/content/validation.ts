import { z } from "zod";
import { ApiError } from "../http/errors";
import { CONTENT_LIMITS as L } from "./limits";
import { serverMediaId } from "./rich-policy";
import type { PostDraftInput, CategoryInput } from "./contracts";

const text = (max: number, required = false) =>
  z
    .string()
    .trim()
    .refine((value) => Array.from(value).length <= max && (!required || value.length > 0));
const id = z.string().refine(serverMediaId);
export function normalizeContentSlug(value: string): string {
  if (/[/%?#\\]/.test(value) || [...value].some((c) => c.charCodeAt(0) < 32))
    throw new ApiError(400, "INVALID_CONTENT_INPUT", "Slug không hợp lệ");
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (
    !slug ||
    slug.length > L.slug ||
    ["page", "danh-muc", "preview", "sitemap", "feed"].includes(slug)
  )
    throw new ApiError(400, "INVALID_CONTENT_INPUT", "Slug không hợp lệ hoặc đã dành riêng");
  return slug;
}
const slug = z.string().max(400).transform(normalizeContentSlug);
const author = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("brand") }),
  z.strictObject({ kind: z.literal("account"), id }),
]);
const draft = z.strictObject({
  title: text(L.title, true),
  slug,
  excerpt: text(L.description),
  content: z.string().refine((s) => Buffer.byteLength(s) <= L.inputBytes),
  categoryId: id.nullable(),
  tags: z.array(text(L.tag, true)).max(L.tags),
  author,
  coverMediaId: id.nullable(),
  coverAlt: text(L.description),
  seoTitle: text(L.title),
  seoDescription: text(L.description),
});
const category = z.strictObject({
  name: text(L.title, true),
  slug,
  description: text(L.description),
  parentId: id.nullable(),
  position: z.number().int().min(0).max(1000000),
  active: z.boolean(),
  seoTitle: text(L.title),
  seoDescription: text(L.description),
});
function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new ApiError(400, "INVALID_CONTENT_INPUT", "Nội dung không hợp lệ hoặc vượt giới hạn");
  return result.data;
}
export function validatePostDraft(input: unknown): PostDraftInput {
  const result = parse(draft, input),
    seen = new Set<string>();
  result.tags = result.tags.filter((tag) => {
    const key = tag.normalize("NFC").toLocaleLowerCase("vi");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return result;
}
export function validateCategory(input: unknown): CategoryInput {
  return parse(category, input);
}
