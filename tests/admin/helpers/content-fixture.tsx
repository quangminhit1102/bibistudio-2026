import type { ReactNode } from "react";
import { vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ContentContext, type ContentRuntime } from "../../../src/features/admin/content/context";
import type {
  PostDto,
  CategoryDto,
  ContentHttpModule,
  MediaDto,
  PublicationJob,
} from "../../../src/features/admin/content/contracts";
const id = "bd7f29fa-c7e3-47af-a63d-2b79c5b949da",
  categoryId = "bd7f29fa-c7e3-47af-a63d-2b79c5b949db",
  mediaId = "bd7f29fa-c7e3-47af-a63d-2b79c5b949dc",
  jobId = "bd7f29fa-c7e3-47af-a63d-2b79c5b949dd";
const page = <T,>(items: T[]) => ({ items, total: items.length, page: 1, pageSize: 100 });
export function contentFixture() {
  const category: CategoryDto = {
      id: categoryId,
      revision: 1,
      publicRevision: 1,
      name: "Cảm hứng",
      slug: "cam-hung",
      description: "",
      parentId: null,
      position: 0,
      active: true,
      seoTitle: "",
      seoDescription: "",
    },
    media: MediaDto = {
      id: mediaId,
      originalName: "Cover.webp",
      width: 480,
      height: 320,
      variants: [
        {
          hash: "a".repeat(64),
          file: mediaId + "/" + "a".repeat(64) + ".webp",
          width: 480,
          height: 320,
          bytes: 123,
          mime: "image/webp",
        },
      ],
    },
    post: PostDto = {
      id,
      revision: 1,
      trashedAt: null,
      updatedAt: "2026-11-15T00:00:00Z",
      title: "Bài đang công khai",
      slug: "bai-viet",
      excerpt: "Giới thiệu",
      content: JSON.stringify({ format: "html-v1", html: "<p>Nội dung</p>" }),
      categoryId,
      tags: [],
      author: { kind: "brand" },
      coverMediaId: mediaId,
      coverAlt: "Ảnh bìa",
      seoTitle: "",
      seoDescription: "",
      public: {
        snapshotId: crypto.randomUUID(),
        draftRevision: 1,
        slug: "bai-viet",
        publishedAt: "2026-11-14T00:00:00Z",
        modifiedAt: "2026-11-14T00:00:00Z",
      },
    },
    job: PublicationJob = { id: jobId, status: "queued", generationId: null, error: null };
  const api = {
    capabilities: vi
      .fn<ContentHttpModule["capabilities"]>()
      .mockResolvedValue({ mode: "cms", publicReaderVersion: 1, canWrite: true }),
    posts: {
      list: vi.fn<ContentHttpModule["posts"]["list"]>().mockResolvedValue(page([post])),
      get: vi.fn<ContentHttpModule["posts"]["get"]>().mockResolvedValue(post),
      saveDraft: vi
        .fn<ContentHttpModule["posts"]["saveDraft"]>()
        .mockImplementation(async (_id, input) => ({ ...post, ...input, revision: 2 })),
      duplicate: vi.fn<ContentHttpModule["posts"]["duplicate"]>().mockResolvedValue(post),
      trash: vi
        .fn<ContentHttpModule["posts"]["trash"]>()
        .mockResolvedValue({ ...post, trashedAt: "2026-11-15T00:00:00Z" }),
      restore: vi.fn<ContentHttpModule["posts"]["restore"]>().mockResolvedValue(post),
    },
    categories: {
      list: vi.fn<ContentHttpModule["categories"]["list"]>().mockResolvedValue(page([category])),
      get: vi.fn<ContentHttpModule["categories"]["get"]>().mockResolvedValue(category),
      save: vi.fn<ContentHttpModule["categories"]["save"]>().mockResolvedValue(category),
      remove: vi.fn<ContentHttpModule["categories"]["remove"]>().mockResolvedValue(undefined),
    },
    media: {
      list: vi.fn<ContentHttpModule["media"]["list"]>().mockResolvedValue(page([media])),
      get: vi.fn<ContentHttpModule["media"]["get"]>().mockResolvedValue(media),
      upload: vi.fn<ContentHttpModule["media"]["upload"]>().mockResolvedValue(media),
      read: vi
        .fn<ContentHttpModule["media"]["read"]>()
        .mockResolvedValue(new Blob(["image"], { type: "image/webp" })),
    },
    lookups: {
      authors: vi
        .fn<ContentHttpModule["lookups"]["authors"]>()
        .mockResolvedValue(page([{ id: "brand", kind: "brand", name: "BiBi Studio" }])),
      tags: vi.fn<ContentHttpModule["lookups"]["tags"]>().mockResolvedValue(page([])),
      categories: vi
        .fn<ContentHttpModule["lookups"]["categories"]>()
        .mockResolvedValue({ ...page([category]), ancestors: [] }),
    },
    publications: {
      request: vi.fn<ContentHttpModule["publications"]["request"]>().mockResolvedValue(job),
      status: vi
        .fn<ContentHttpModule["publications"]["status"]>()
        .mockResolvedValue({ ...job, status: "succeeded" }),
    },
  } satisfies ContentHttpModule;
  const value: ContentRuntime = {
    mode: "http",
    api,
    capabilities: { mode: "cms", publicReaderVersion: 1, canWrite: true },
    pending: false,
    error: null,
    retry: vi.fn(),
    can: () => true,
  };
  return { api, value, post, category, media, jobId };
}
export function ContentHarness({
  value,
  children,
}: {
  value: ContentRuntime;
  children: ReactNode;
}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return (
    <QueryClientProvider client={client}>
      <ContentContext.Provider value={value}>{children}</ContentContext.Provider>
    </QueryClientProvider>
  );
}
