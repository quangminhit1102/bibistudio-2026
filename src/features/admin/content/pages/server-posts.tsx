import { useState, useRef } from "react";
import { useQuery, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useContent } from "../context";
import type { PostDto, ContentListInput, PublicationRequest } from "../contracts";
import {
  PageTitle,
  Button,
  Badge,
  Card,
  ConfirmDialog,
  ErrorState,
  Skeleton,
} from "../../shared/ui/primitives";
import { PublicationStatus } from "../components/publication-status";
export default function ServerPosts() {
  const context = useContent(),
    { api, can, capabilities } = context,
    cache = useQueryClient(),
    [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [categorySearch, setCategorySearch] = useState(""),
    [categoryId, setCategoryId] = useState<string | undefined>(),
    [status, setStatus] = useState<ContentListInput["status"]>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [trash, setTrash] = useState<PostDto | null>(null),
    [jobId, setJobId] = useState<string | null>(null),
    [publishing, setPublishing] = useState(false),
    [jobTarget, setJobTarget] = useState<string | null>(null),
    pending = useRef(new Map<string, PublicationRequest>()),
    query = useQuery({
      queryKey: ["bibi-admin", "content", "posts", page, search, status, categoryId],
      queryFn: ({ signal }) => {
        if (!api) throw Error("API nội dung chưa sẵn sàng");
        return api.posts.list(
          { page, pageSize: 20, search, status, categoryId, sort: "updated_desc" },
          signal,
        );
      },
      enabled: Boolean(api && can("post.view")),
      retry: false,
    });
  const categories = useInfiniteQuery({
    queryKey: ["bibi-admin", "content", "list-category-choices", categorySearch],
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
  const categoryChoices = [
    ...new Map(
      categories.data?.pages
        .flatMap((page) => [...page.items, ...page.ancestors])
        .map((category) => [category.id, category]) ?? [],
    ).values(),
  ];
  async function action(post: PostDto, kind: "duplicate" | "restore" | "trash") {
    if (!api || busy || publishing) return;
    setBusy(true);
    setError("");
    setJobId(null);
    try {
      if (kind === "duplicate") await api.posts.duplicate(post.id);
      else if (kind === "restore") await api.posts.restore(post.id, post.revision);
      else if (post.public) {
        const key = post.id + ":" + post.revision;
        const request: PublicationRequest = pending.current.get(key) ?? {
          action: "trash",
          targetId: post.id,
          expectedRevision: post.revision,
          idempotencyKey: crypto.randomUUID(),
        };
        pending.current.set(key, request);
        const job = await api.publications.request(request);
        setJobId(job.id);
        setJobTarget(key);
        setPublishing(!["succeeded", "failed"].includes(job.status));
      } else await api.posts.trash(post.id, post.revision);
      setTrash(null);
      await cache.invalidateQueries({ queryKey: ["bibi-admin", "content", "posts"] });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thực hiện được thao tác");
    } finally {
      setBusy(false);
    }
  }
  if (context.error) return <ErrorState error={context.error} onRetry={context.retry} />;
  if (!api) return <ErrorState error={new Error("API nội dung chưa sẵn sàng")} />;
  if (context.pending) return <Skeleton />;
  if (!can("post.view")) return <ErrorState error={new Error("Bạn không có quyền xem bài viết")} />;
  return (
    <>
      <PageTitle
        title="Bài viết"
        description="Bản nháp dùng chung trên máy chủ; bản công khai chỉ thay đổi sau khi xuất bản."
      />
      {!capabilities?.canWrite && <p className="a-banner">Nội dung đang ở chế độ chỉ đọc.</p>}
      <div className="a-form-footer">
        <label className="a-field">
          Tìm bài viết
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <label className="a-field">
          Trạng thái
          <select
            value={status ?? ""}
            onChange={(event) => {
              setStatus((event.target.value as ContentListInput["status"]) || undefined);
              setPage(1);
            }}
          >
            <option value="">Tất cả bài đang dùng</option>
            <option value="draft">Bản nháp</option>
            <option value="published">Đang công khai</option>
            <option value="trash">Thùng rác</option>
          </select>
        </label>
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
              value={categoryId ?? ""}
              onChange={(event) => {
                setCategoryId(event.target.value || undefined);
                setPage(1);
              }}
            >
              <option value="">Tất cả danh mục</option>
              {categoryId && !categoryChoices.some((category) => category.id === categoryId) && (
                <option value={categoryId}>Danh mục đang lọc</option>
              )}
              {categoryChoices.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <Button
            disabled={!categories.hasNextPage || categories.isFetchingNextPage}
            onClick={() => void categories.fetchNextPage()}
          >
            Tải thêm danh mục
          </Button>
        </div>
        {can("post.create") && capabilities?.canWrite && (
          <Link to={"/admin/content/posts/create" as "/admin"} className="a-btn a-btn-primary">
            Viết bài mới
          </Link>
        )}
      </div>
      {error && (
        <p role="alert" className="a-error">
          {error}
        </p>
      )}
      {query.error && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      {categories.error && (
        <ErrorState error={categories.error} onRetry={() => void categories.refetch()} />
      )}
      <Card>
        {query.isPending ? (
          <Skeleton />
        ) : (
          <div className="a-table-scroll">
            <table className="a-table">
              <thead>
                <tr>
                  <th>Bài viết</th>
                  <th>Trạng thái</th>
                  <th>Cập nhật bản nháp</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {query.data?.items.map((post) => (
                  <tr key={post.id}>
                    <td>
                      <Link to={("/admin/content/posts/" + post.id) as "/admin"}>{post.title}</Link>
                      <p className="a-muted">/blog/{post.slug}</p>
                    </td>
                    <td>
                      {post.trashedAt ? (
                        <Badge>Thùng rác</Badge>
                      ) : post.public ? (
                        <>
                          <Badge tone="success">Đang công khai</Badge>
                          {post.public.draftRevision !== post.revision && (
                            <Badge>Có thay đổi chưa đăng</Badge>
                          )}
                        </>
                      ) : (
                        <Badge>Bản nháp</Badge>
                      )}
                    </td>
                    <td>{new Date(post.updatedAt).toLocaleString("vi-VN")}</td>
                    <td>
                      <div className="a-form-footer">
                        {!post.trashedAt && (can("post.update") || can("post.publish")) && (
                          <Link
                            className="a-btn a-btn-outline"
                            to={("/admin/content/posts/" + post.id + "/edit") as "/admin"}
                          >
                            {can("post.update") ? "Sửa" : "Xuất bản"}
                          </Link>
                        )}
                        {!post.trashedAt && can("post.create") && (
                          <Button
                            disabled={busy || publishing || !capabilities?.canWrite}
                            onClick={() => void action(post, "duplicate")}
                          >
                            Nhân bản
                          </Button>
                        )}
                        {post.trashedAt
                          ? can("post.restore") && (
                              <Button
                                disabled={busy || publishing || !capabilities?.canWrite}
                                onClick={() => void action(post, "restore")}
                              >
                                Khôi phục
                              </Button>
                            )
                          : can("post.delete") && (
                              <Button
                                disabled={
                                  busy ||
                                  publishing ||
                                  !capabilities?.canWrite ||
                                  Boolean(post.public && !can("post.publish"))
                                }
                                onClick={() => setTrash(post)}
                              >
                                Thùng rác
                              </Button>
                            )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {query.data?.items.length === 0 && (
              <p className="a-dialog-body">Chưa có bài viết phù hợp.</p>
            )}
          </div>
        )}
      </Card>
      <div className="a-form-footer">
        <Button disabled={page === 1 || query.isFetching} onClick={() => setPage(page - 1)}>
          Trang trước
        </Button>
        <span>
          Trang {page} · {query.data?.total ?? 0} bài
        </span>
        <Button
          disabled={!query.data || page * 20 >= query.data.total || query.isFetching}
          onClick={() => setPage(page + 1)}
        >
          Trang sau
        </Button>
      </div>
      {jobId && (
        <PublicationStatus
          jobId={jobId}
          onTerminal={() => {
            setPublishing(false);
            if (jobTarget) pending.current.delete(jobTarget);
            void cache.invalidateQueries({ queryKey: ["bibi-admin", "content", "posts"] });
          }}
        />
      )}
      <ConfirmDialog
        open={Boolean(trash)}
        title={trash?.public ? "Gỡ bài và chuyển vào thùng rác?" : "Chuyển bài vào thùng rác?"}
        description="Bài có thể được khôi phục. Ảnh đã từng công khai vẫn có thể truy cập qua URL cũ."
        onCancel={() => setTrash(null)}
        onConfirm={() => (trash ? action(trash, "trash") : undefined)}
      />
    </>
  );
}
