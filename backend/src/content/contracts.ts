/** Wire types and immutable publication contracts. All imports are type-only. */
export type ContentMode = "bridge" | "cms";
export type AuthorRef = { kind: "brand" } | { kind: "account"; id: string };
export interface ContentListInput {
  page: number;
  pageSize: number;
  search?: string;
  status?: "draft" | "published" | "trash";
  categoryId?: string;
  sort?: "updated_desc" | "published_desc";
}
export interface PostDraftInput {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  categoryId: string | null;
  tags: string[];
  author: AuthorRef;
  coverMediaId: string | null;
  coverAlt: string;
  seoTitle: string;
  seoDescription: string;
}
export interface CategoryInput {
  name: string;
  slug: string;
  description: string;
  parentId: string | null;
  position: number;
  active: boolean;
  seoTitle: string;
  seoDescription: string;
}
export interface SanitizedContent {
  content: string;
  html: string;
  plainText: string;
  mediaIds: string[];
}
export interface MediaVariant {
  hash: string;
  file: string;
  mime: "image/webp" | "image/jpeg" | "image/png";
  width: number;
  height: number;
  bytes: number;
}
export interface MediaDto {
  id: string;
  originalName: string;
  width: number;
  height: number;
  variants: MediaVariant[];
}
export interface PostDto extends PostDraftInput {
  id: string;
  revision: number;
  trashedAt: string | null;
  updatedAt: string;
  public: null | {
    snapshotId: string;
    draftRevision: number;
    slug: string;
    publishedAt: string;
    modifiedAt: string;
  };
}
export interface CategoryDto extends CategoryInput {
  id: string;
  revision: number;
  publicRevision: number | null;
}
export interface PublishedPost {
  id: string;
  snapshotId: string;
  draftRevision: number;
  title: string;
  slug: string;
  excerpt: string;
  html: string;
  categoryId: string;
  tags: string[];
  author: { kind: "brand" | "account"; name: string };
  coverMediaId: string;
  coverAlt: string;
  seoTitle: string;
  seoDescription: string;
  publishedAt: string;
  modifiedAt: string;
  mediaIds: string[];
}
export interface PublicAssetManifest {
  schemaVersion: 1;
  rendererVersion: string;
  css: string[];
  script: string;
  assets: string[];
  staticRoutes: Array<{ path: string; lastmod?: string }>;
}
export interface PublicSnapshot {
  schemaVersion: 1;
  generationId: string;
  posts: PublishedPost[];
  categories: CategoryDto[];
  redirects: Record<string, string>;
  media: Record<string, MediaVariant>;
  routes: Array<{ path: string; label: string }>;
  committedAt: string;
}
export type PublicRoute =
  | {
      kind: "html";
      file: string;
      sha256: string;
      indexable: boolean;
      contentType: "text/html" | "application/xml";
    }
  | { kind: "redirect"; location: string; status: 301 };
export interface GenerationManifest {
  schemaVersion: 1;
  id: string;
  previousId: string | null;
  rendererVersion: string;
  publicDataFile: string;
  publicDataSha256: string;
  routes: Record<string, PublicRoute>;
  media: Record<string, MediaVariant>;
  assets: string[];
  fileHashes: Record<string, string>;
}
export interface RenderedGeneration {
  manifest: GenerationManifest;
  files: Map<string, Uint8Array>;
}
export interface PublicationRequest {
  action: "publish" | "unpublish" | "trash" | "apply-category" | "delete-category";
  targetId: string;
  expectedRevision: number;
  idempotencyKey: string;
  categoryRevisionToApply?: number;
}
export interface PublicationJob {
  id: string;
  status: "queued" | "building" | "prepared" | "verifying" | "succeeded" | "failed";
  generationId: string | null;
  error: null | { code: string; message: string };
}
/** Absolute paths supplied only by the trusted bootstrap/config. */
export interface ContentPaths {
  root: string;
  media: string;
  generations: string;
  active: string;
  deployLock: string;
  managedRoots: string[];
  maxManagedBytes: number;
  maxContentBytes: number;
  maxGenerationBytes: number;
  minHeadroomBytes: number;
}
export interface ContentCheckReport {
  ok: true;
  sourceSha: string;
  releaseId: string;
  generationId: string | null;
  checks: Record<string, boolean>;
  screenshots: string[];
}
