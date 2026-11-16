import type { Page } from "../../../../backend/src/http/contracts";
import type {
  AuthorChoice,
  CategoryChoice,
  ContentLookupInput,
} from "../../../../backend/src/content/lookups";
import type {
  CategoryDto,
  CategoryInput,
  PostDto,
  PostDraftInput,
  ContentListInput,
  MediaDto,
  PublicationJob,
  PublicationRequest,
} from "../../../../backend/src/content/contracts";
export type {
  CategoryDto,
  CategoryInput,
  PostDto,
  PostDraftInput,
  MediaDto,
  PublicationJob,
  PublicationRequest,
  AuthorChoice,
  CategoryChoice,
  ContentLookupInput,
  ContentListInput,
  Page,
};
export interface ContentCapabilities {
  mode: "bridge" | "cms";
  publicReaderVersion: 1;
  canWrite: boolean;
}
export interface ContentHttpModule {
  capabilities(signal?: AbortSignal): Promise<ContentCapabilities>;
  posts: {
    list(input: ContentListInput, signal?: AbortSignal): Promise<Page<PostDto>>;
    get(id: string, signal?: AbortSignal): Promise<PostDto>;
    saveDraft(
      id: string | null,
      input: PostDraftInput,
      expectedRevision: number | null,
      signal?: AbortSignal,
    ): Promise<PostDto>;
    duplicate(id: string, signal?: AbortSignal): Promise<PostDto>;
    trash(id: string, revision: number, signal?: AbortSignal): Promise<PostDto>;
    restore(id: string, revision: number, signal?: AbortSignal): Promise<PostDto>;
  };
  categories: {
    list(input: ContentLookupInput, signal?: AbortSignal): Promise<Page<CategoryDto>>;
    get(id: string, signal?: AbortSignal): Promise<CategoryDto>;
    save(
      id: string | null,
      input: CategoryInput,
      expectedRevision: number | null,
      signal?: AbortSignal,
    ): Promise<CategoryDto>;
    remove(id: string, revision: number, signal?: AbortSignal): Promise<void>;
  };
  media: {
    list(input: ContentLookupInput, signal?: AbortSignal): Promise<Page<MediaDto>>;
    get(id: string, signal?: AbortSignal): Promise<MediaDto>;
    upload(file: File, signal?: AbortSignal): Promise<MediaDto>;
    read(id: string, hash: string, signal?: AbortSignal): Promise<Blob>;
  };
  lookups: {
    authors(input: ContentLookupInput, signal?: AbortSignal): Promise<Page<AuthorChoice>>;
    tags(
      input: ContentLookupInput,
      signal?: AbortSignal,
    ): Promise<Page<{ id: string; name: string }>>;
    categories(
      input: ContentLookupInput,
      signal?: AbortSignal,
    ): Promise<Page<CategoryChoice> & { ancestors: CategoryChoice[] }>;
  };
  publications: {
    request(input: PublicationRequest, signal?: AbortSignal): Promise<PublicationJob>;
    status(id: string, signal?: AbortSignal): Promise<PublicationJob>;
  };
}
export interface MediaLease {
  url: string;
  release: () => void;
}
export interface RichMediaAdapter {
  resolve(id: string, signal?: AbortSignal): Promise<MediaLease>;
}
export const emptyPostDraft = (): PostDraftInput => ({
  title: "",
  slug: "",
  excerpt: "",
  content: JSON.stringify({ format: "html-v1", html: "" }),
  categoryId: null,
  tags: [],
  author: { kind: "brand" },
  coverMediaId: null,
  coverAlt: "",
  seoTitle: "",
  seoDescription: "",
});
export function postDraft(post: PostDto): PostDraftInput {
  return Object.fromEntries(
    Object.keys(emptyPostDraft()).map((key) => [key, post[key as keyof PostDraftInput]]),
  ) as unknown as PostDraftInput;
}
