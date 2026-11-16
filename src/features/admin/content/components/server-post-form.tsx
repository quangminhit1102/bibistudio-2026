import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useContent } from "../context";
import {
  emptyPostDraft,
  postDraft,
  type PostDto,
  type PostDraftInput,
  type PublicationJob,
  type PublicationRequest,
} from "../contracts";
import { createServerMediaAdapter } from "../media/server-adapter";
import { readRichContent } from "../rich-content";
import RichEditor from "./rich-editor";
import { ServerMediaPicker, ServerMediaImage } from "./server-media-picker";
import { PublicationStatus } from "./publication-status";
import {
  Button,
  Badge,
  Card,
  ConfirmDialog,
  ErrorState,
  PageTitle,
  Skeleton,
  Modal,
} from "../../shared/ui/primitives";
import { useUnsavedChanges } from "../../shared/forms/unsaved-guard";
const signature = (value: PostDraftInput) => JSON.stringify(value);
const suggestSlug = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 200);
export function ServerPostForm({
  id,
  onCreated,
  readOnly = false,
}: {
  id?: string;
  onCreated?: (id: string) => void;
  readOnly?: boolean;
}) {
  const context = useContent(),
    { api, can, capabilities } = context,
    queryClient = useQueryClient();
  const initial = emptyPostDraft(),
    [state, setState] = useState<{
      record: PostDto | null;
      values: PostDraftInput;
      baseline: string;
    }>({ record: null, values: initial, baseline: signature(initial) }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [jobId, setJobId] = useState<string | null>(null),
    [publishing, setPublishing] = useState(false),
    [preview, setPreview] = useState(false),
    [authorSearch, setAuthorSearch] = useState(""),
    [categorySearch, setCategorySearch] = useState("");
  const [tagsText, setTagsText] = useState("");
  const operation = useRef<AbortController | null>(null),
    pending = useRef<{ input: PublicationRequest; fingerprint: string } | null>(null),
    slugTouched = useRef(Boolean(id)),
    latest = useRef(state);
  latest.current = state;
  const dirty = signature(state.values) !== state.baseline,
    blocker = useUnsavedChanges(dirty),
    allowed =
      !readOnly &&
      Boolean(capabilities?.canWrite) &&
      can(state.record ? "post.update" : "post.create");
  const loaded = useQuery({
    queryKey: ["bibi-admin", "content", "post", id],
    queryFn: ({ signal }) => {
      if (!api || !id) throw Error("API nội dung chưa sẵn sàng");
      return api.posts.get(id, signal);
    },
    enabled: Boolean(api && id && can("post.view")),
    retry: false,
  });
  useEffect(() => {
    if (loaded.data && loaded.data.id === id && latest.current.record?.id !== id) {
      const values = postDraft(loaded.data);
      setState({ record: loaded.data, values, baseline: signature(values) });
      slugTouched.current = true;
      pending.current = null;
      setJobId(null);
    }
  }, [loaded.data, id]);
  useEffect(() => {
    return () => operation.current?.abort();
  }, [api, id]);
  useEffect(
    () => setTagsText(latest.current.values.tags.join(", ")),
    [state.record?.id, state.record?.revision],
  );
  const categories = useInfiniteQuery({
    queryKey: ["bibi-admin", "content", "category-choices", categorySearch],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => {
      if (!api) throw Error("API nội dung chưa sẵn sàng");
      return api.lookups.categories(
        { page: pageParam, pageSize: 100, search: categorySearch },
        signal,
      );
    },
    getNextPageParam: (last) =>
      last.page * last.pageSize < last.total ? last.page + 1 : undefined,
    enabled: Boolean(api && can("post.view")),
    retry: false,
  });
  const authors = useInfiniteQuery({
    queryKey: ["bibi-admin", "content", "authors", authorSearch],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => {
      if (!api) throw Error("API nội dung chưa sẵn sàng");
      return api.lookups.authors({ page: pageParam, pageSize: 100, search: authorSearch }, signal);
    },
    getNextPageParam: (last) =>
      last.page * last.pageSize < last.total ? last.page + 1 : undefined,
    enabled: Boolean(api && can("post.view")),
    retry: false,
  });
  const choices = [
      ...new Map(
        categories.data?.pages
          .flatMap((page) => [...page.items, ...page.ancestors])
          .map((category) => [category.id, category]) ?? [],
      ).values(),
    ],
    authorChoices = authors.data?.pages.flatMap((page) => page.items) ?? [];
  const media = useMemo(() => {
    if (!api) return undefined;
    const adapter = createServerMediaAdapter(api.media);
    return {
      ...adapter,
      picker: (props: { value: string[]; onChange: (value: string[]) => void; max: number }) => (
        <ServerMediaPicker {...props} />
      ),
    };
  }, [api]);
  const change = <K extends keyof PostDraftInput>(key: K, value: PostDraftInput[K]) =>
    setState((current) => ({ ...current, values: { ...current.values, [key]: value } }));
  async function save(signal: AbortSignal): Promise<PostDto> {
    if (!api) throw Error("API nội dung chưa sẵn sàng");
    const current = latest.current;
    if (!current.values.title.trim() || !current.values.slug.trim())
      throw Error("Nhập tiêu đề và đường dẫn trước khi lưu");
    if (current.record && signature(current.values) === current.baseline) return current.record;
    if (!allowed) throw Error("Bạn không có quyền lưu bài viết");
    const saved = await api.posts.saveDraft(
      current.record?.id ?? null,
      current.values,
      current.record?.revision ?? null,
      signal,
    );
    signal.throwIfAborted();
    const values = postDraft(saved);
    const next = { record: saved, values, baseline: signature(values) };
    latest.current = next;
    flushSync(() => setState(next));
    return saved;
  }
  async function submit(action: "save" | "publish" | "unpublish") {
    if (busy || !api) return;
    setBusy(true);
    setError("");
    setNotice("");
    if (!publishing) setJobId(null);
    operation.current?.abort();
    const controller = new AbortController();
    operation.current = controller;
    try {
      const current = latest.current;
      const reusable =
        action !== "save" &&
        pending.current &&
        pending.current.input.action === action &&
        pending.current.fingerprint === signature(current.values);
      let saved = current.record,
        request: PublicationRequest;
      if (reusable) {
        request = pending.current!.input;
      } else {
        saved = action === "unpublish" ? current.record : await save(controller.signal);
        if (!saved) throw Error("Lưu bản nháp trước khi xuất bản");
        if (action === "save") {
          setNotice("Đã lưu nháp");
          await queryClient.invalidateQueries({ queryKey: ["bibi-admin", "content", "posts"] });
          if (!id) onCreated?.(saved.id);
          return;
        }
        if (!can("post.publish")) throw Error("Bạn không có quyền xuất bản");
        if (
          action === "publish" &&
          (!saved.categoryId || !saved.coverMediaId || !saved.coverAlt.trim())
        )
          throw Error("Đã lưu nháp. Bổ sung danh mục, ảnh bìa và mô tả ảnh trước khi đăng.");
        request = {
          action,
          targetId: saved.id,
          expectedRevision: saved.revision,
          idempotencyKey: crypto.randomUUID(),
        };
        pending.current = { input: request, fingerprint: signature(latest.current.values) };
      }
      const job = await api.publications.request(request, controller.signal);
      controller.signal.throwIfAborted();
      setJobId(job.id);
      setPublishing(!["succeeded", "failed"].includes(job.status));
    } catch (failure) {
      if (!controller.signal.aborted)
        setError(failure instanceof Error ? failure.message : "Không thực hiện được yêu cầu");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  const terminal = useCallback(
    (job: PublicationJob) => {
      setPublishing(false);
      pending.current = null;
      if (job.status === "succeeded" && api) {
        const record = latest.current.record;
        if (record)
          void api.posts.get(record.id).then(
            (fresh) => {
              setState((current) => ({
                ...current,
                record: current.record
                  ? { ...current.record, public: fresh.public, trashedAt: fresh.trashedAt }
                  : fresh,
              }));
              void queryClient.invalidateQueries({ queryKey: ["bibi-admin", "content", "posts"] });
              if (!id && !dirty) onCreated?.(record.id);
            },
            () =>
              setError(
                "Đã xuất bản nhưng chưa tải lại được trạng thái. Kiểm tra lại trước khi chỉnh sửa tiếp.",
              ),
          );
      }
    },
    [api, queryClient, id, onCreated, dirty],
  );
  if (context.error) return <ErrorState error={context.error} onRetry={context.retry} />;
  if (!api) return <ErrorState error={new Error("API nội dung chưa sẵn sàng")} />;
  if (context.pending) return <Skeleton />;
  if (!can("post.view")) return <ErrorState error={new Error("Bạn không có quyền xem bài viết")} />;
  if (id && loaded.error && state.record?.id !== id)
    return <ErrorState error={loaded.error} onRetry={() => void loaded.refetch()} />;
  if (id && state.record?.id !== id) return <Skeleton />;
  const values = state.values,
    disabled = !allowed || busy,
    publicState = state.record?.public,
    authorValue = values.author.kind === "brand" ? "brand" : values.author.id;
  return (
    <>
      <PageTitle
        title={state.record ? "Chỉnh sửa bài viết" : "Thêm bài viết"}
        description="Lưu bản nháp và áp dụng nội dung lên website bằng thao tác xuất bản."
      />
      <div className="a-form-footer">
        {publicState && <Badge tone="success">Đang công khai</Badge>}
        {publicState && state.record!.revision !== publicState.draftRevision && (
          <Badge>Có thay đổi chưa đăng</Badge>
        )}
        {!publicState && <Badge>Bản nháp</Badge>}
      </div>
      {!capabilities?.canWrite && (
        <p className="a-banner">
          Nội dung đang ở chế độ chỉ đọc. Bản website hiện tại vẫn được giữ nguyên.
        </p>
      )}
      {loaded.error && <ErrorState error={loaded.error} onRetry={() => void loaded.refetch()} />}
      <Card>
        <form
          className="a-compose-stack"
          onSubmit={(event) => {
            event.preventDefault();
            void submit("save");
          }}
        >
          <label className="a-field">
            Tiêu đề
            <input
              required
              maxLength={300}
              value={values.title}
              disabled={disabled}
              onChange={(event) => {
                const title = event.target.value;
                setState((current) => ({
                  ...current,
                  values: {
                    ...current.values,
                    title,
                    ...(!slugTouched.current ? { slug: suggestSlug(title) } : {}),
                  },
                }));
              }}
            />
          </label>
          <label className="a-field">
            Đường dẫn
            <input
              required
              maxLength={200}
              value={values.slug}
              disabled={disabled}
              onChange={(event) => {
                slugTouched.current = true;
                change("slug", event.target.value);
              }}
            />
            <small>/blog/{values.slug || "duong-dan-bai-viet"}</small>
          </label>
          <label className="a-field">
            Tóm tắt
            <textarea
              maxLength={1000}
              value={values.excerpt}
              disabled={disabled}
              onChange={(event) => change("excerpt", event.target.value)}
            />
          </label>
          <div className="a-form-grid">
            <div>
              <label className="a-field">
                Tìm danh mục
                <input
                  value={categorySearch}
                  onChange={(event) => setCategorySearch(event.target.value)}
                />
              </label>
              <label className="a-field">
                Danh mục
                <select
                  value={values.categoryId ?? ""}
                  disabled={disabled}
                  onChange={(event) => change("categoryId", event.target.value || null)}
                >
                  <option value="">Chưa chọn danh mục</option>
                  {values.categoryId && !choices.some((item) => item.id === values.categoryId) && (
                    <option value={values.categoryId}>Danh mục đang dùng (giữ nguyên)</option>
                  )}
                  {choices.map((category) => (
                    <option
                      key={category.id}
                      value={category.id}
                      disabled={!category.active && category.id !== values.categoryId}
                    >
                      {category.name}
                      {!category.active ? " (đang ẩn)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              {categories.error && (
                <ErrorState error={categories.error} onRetry={() => void categories.refetch()} />
              )}
              <Button
                disabled={!categories.hasNextPage || categories.isFetchingNextPage}
                onClick={() => void categories.fetchNextPage()}
              >
                Tải thêm danh mục
              </Button>
            </div>
            <div>
              <label className="a-field">
                Tìm tác giả
                <input
                  value={authorSearch}
                  onChange={(event) => setAuthorSearch(event.target.value)}
                />
              </label>
              <label className="a-field">
                Tác giả
                <select
                  disabled={disabled}
                  value={authorValue}
                  onChange={(event) =>
                    change(
                      "author",
                      event.target.value === "brand"
                        ? { kind: "brand" }
                        : { kind: "account", id: event.target.value },
                    )
                  }
                >
                  <option value="brand">BiBi Studio</option>
                  {authorValue !== "brand" &&
                    !authorChoices.some((author) => author.id === authorValue) && (
                      <option value={authorValue}>Tác giả đang dùng</option>
                    )}
                  {authorChoices
                    .filter((author) => author.kind !== "brand")
                    .map((author) => (
                      <option key={author.id} value={author.id}>
                        {author.name}
                      </option>
                    ))}
                </select>
              </label>
              {authors.error && (
                <ErrorState error={authors.error} onRetry={() => void authors.refetch()} />
              )}
              <Button
                disabled={!authors.hasNextPage || authors.isFetchingNextPage}
                onClick={() => void authors.fetchNextPage()}
              >
                Tải thêm tác giả
              </Button>
            </div>
          </div>
          <label className="a-field">
            Thẻ bài viết
            <input
              value={tagsText}
              disabled={disabled}
              onChange={(event) => {
                setTagsText(event.target.value);
                change(
                  "tags",
                  event.target.value
                    .split(",")
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                );
              }}
            />
            <small>Tối đa 10 thẻ, phân cách bằng dấu phẩy.</small>
          </label>
          <RichEditor
            key={state.record?.revision ?? "new"}
            value={values.content}
            onChange={(value) => change("content", value)}
            media={media}
            disabled={disabled}
          />
          <fieldset disabled={disabled}>
            <legend>Ảnh bìa</legend>
            {values.coverMediaId && (
              <ServerMediaImage
                id={values.coverMediaId}
                alt={values.coverAlt}
                className="a-content-cover"
              />
            )}
            <ServerMediaPicker
              value={values.coverMediaId ? [values.coverMediaId] : []}
              onChange={(ids) => change("coverMediaId", ids[0] ?? null)}
              disabled={disabled}
            />
            <label className="a-field">
              Mô tả ảnh bìa
              <input
                maxLength={1000}
                value={values.coverAlt}
                onChange={(event) => change("coverAlt", event.target.value)}
              />
            </label>
          </fieldset>
          <label className="a-field">
            Tiêu đề SEO
            <input
              maxLength={300}
              value={values.seoTitle}
              disabled={disabled}
              onChange={(event) => change("seoTitle", event.target.value)}
            />
            <small>Để trống để dùng tiêu đề bài viết.</small>
          </label>
          <label className="a-field">
            Mô tả SEO
            <textarea
              maxLength={1000}
              value={values.seoDescription}
              disabled={disabled}
              onChange={(event) => change("seoDescription", event.target.value)}
            />
            <small>Để trống để dùng phần tóm tắt hoặc nội dung bài.</small>
          </label>
          {error && (
            <p role="alert" className="a-error">
              {error}
            </p>
          )}
          {notice && <p role="status">{notice}</p>}
          <div className="a-form-footer">
            <Button onClick={() => setPreview(true)}>Xem trước</Button>
            <Button type="submit" disabled={!allowed || busy} loading={busy}>
              Lưu nháp
            </Button>
            {can("post.publish") && (
              <Button
                variant="primary"
                disabled={
                  readOnly ||
                  !capabilities?.canWrite ||
                  (!allowed && (!state.record || dirty)) ||
                  busy ||
                  publishing
                }
                onClick={() => void submit("publish")}
              >
                {publicState ? "Cập nhật bài" : "Đăng bài"}
              </Button>
            )}
            {publicState && can("post.publish") && (
              <Button
                disabled={readOnly || !capabilities?.canWrite || busy || publishing}
                onClick={() => void submit("unpublish")}
              >
                Gỡ về nháp
              </Button>
            )}
          </div>
          {!id && state.record && (
            <a href={"/admin/content/posts/" + state.record.id + "/edit"}>Mở bản nháp đã lưu</a>
          )}
        </form>
      </Card>
      {jobId && <PublicationStatus jobId={jobId} onTerminal={terminal} />}
      <ConfirmDialog
        open={blocker.status === "blocked"}
        title="Bỏ thay đổi chưa lưu?"
        description="Nội dung đang chỉnh sửa sẽ không được lưu."
        onCancel={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
      />
      <Modal open={preview} onOpenChange={setPreview} title="Xem trước bản đang soạn" wide>
        <article className="a-dialog-body">
          <h1>{values.title}</h1>
          <p>{values.excerpt}</p>
          <ServerDraftPreview content={values.content} />
        </article>
      </Modal>
    </>
  );
}
function ServerDraftPreview({ content }: { content: string }) {
  const { api } = useContent(),
    adapter = useMemo(() => (api ? createServerMediaAdapter(api.media) : null), [api]),
    [html, setHtml] = useState("");
  useEffect(() => {
    const controller = new AbortController(),
      leases: Array<() => void> = [],
      root = document.createElement("div");
    root.innerHTML = readRichContent(content);
    void Promise.all(
      [...root.querySelectorAll("img[data-media-id]")].map(async (image) => {
        try {
          if (!adapter) return;
          const lease = await adapter.resolve(
            image.getAttribute("data-media-id")!,
            controller.signal,
          );
          if (controller.signal.aborted) {
            lease.release();
            return;
          }
          leases.push(lease.release);
          image.setAttribute("src", lease.url);
        } catch {
          image.removeAttribute("src");
        }
      }),
    ).then(() => {
      if (!controller.signal.aborted) setHtml(root.innerHTML);
    });
    return () => {
      controller.abort();
      leases.forEach((release) => release());
    };
  }, [content, adapter]);
  return <div className="content-prose" dangerouslySetInnerHTML={{ __html: html }} />;
}
