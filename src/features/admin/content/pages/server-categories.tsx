import { useCallback, useRef, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useContent } from "../context";
import { categoryParentChoices } from "../capabilities";
import type { CategoryDto, CategoryInput, PublicationRequest, PublicationJob } from "../contracts";
import { PublicationStatus } from "../components/publication-status";
import { useUnsavedChanges } from "../../shared/forms/unsaved-guard";
import {
  PageTitle,
  Button,
  Badge,
  Card,
  ErrorState,
  Skeleton,
  ConfirmDialog,
} from "../../shared/ui/primitives";
const empty = (): CategoryInput => ({
  name: "",
  slug: "",
  description: "",
  parentId: null,
  position: 0,
  active: true,
  seoTitle: "",
  seoDescription: "",
});
const input = (category: CategoryDto): CategoryInput => ({
  name: category.name,
  slug: category.slug,
  description: category.description,
  parentId: category.parentId,
  position: category.position,
  active: category.active,
  seoTitle: category.seoTitle,
  seoDescription: category.seoDescription,
});
export default function ServerCategories() {
  const context = useContent(),
    { api, can, capabilities } = context,
    cache = useQueryClient(),
    [record, setRecord] = useState<CategoryDto | null>(null),
    [values, setValues] = useState(empty),
    [baseline, setBaseline] = useState(JSON.stringify(empty())),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [publishing, setPublishing] = useState(false),
    [jobId, setJobId] = useState<string | null>(null),
    [confirm, setConfirm] = useState(false),
    pending = useRef<{ request: PublicationRequest; fingerprint: string } | null>(null),
    dirty = JSON.stringify(values) !== baseline,
    blocker = useUnsavedChanges(dirty),
    query = useQuery({
      queryKey: ["bibi-admin", "content", "categories"],
      queryFn: async ({ signal }) => {
        if (!api) throw Error("API nội dung chưa sẵn sàng");
        const result: CategoryDto[] = [];
        let page = 1;
        for (;;) {
          const next = await api.categories.list({ page, pageSize: 100 }, signal);
          result.push(...next.items);
          if (page * 100 >= next.total) break;
          if (page >= 100) throw Error("Danh sách danh mục vượt giới hạn hỗ trợ");
          page++;
        }
        return result;
      },
      enabled: Boolean(api && can("content_category.view")),
      retry: false,
    });
  const edit =
      Boolean(capabilities?.canWrite) &&
      can(record ? "content_category.update" : "content_category.create"),
    parents = categoryParentChoices(query.data ?? [], record?.id ?? null);
  const labels = new Map(parents.map((parent) => [parent.id, parent.label])),
    locked = busy || publishing,
    operation = useRef<AbortController | null>(null);
  useEffect(() => () => operation.current?.abort(), [api]);
  function reset(category: CategoryDto | null) {
    setJobId(null);
    const next = category ? input(category) : empty();
    setRecord(category);
    setValues(next);
    setBaseline(JSON.stringify(next));
    setError("");
    setNotice("");
    pending.current = null;
  }
  async function save(signal: AbortSignal) {
    if (!api) throw Error("API nội dung chưa sẵn sàng");
    if (record && !dirty) return record;
    if (!edit) throw Error("Bạn không có quyền lưu danh mục");
    const saved = await api.categories.save(
      record?.id ?? null,
      values,
      record?.revision ?? null,
      signal,
    );
    signal.throwIfAborted();
    const next = input(saved);
    setRecord(saved);
    setValues(next);
    setBaseline(JSON.stringify(next));
    await cache.invalidateQueries({ queryKey: ["bibi-admin", "content", "categories"] });
    return saved;
  }
  async function submit(apply: boolean) {
    if (!api || locked) return;
    setBusy(true);
    setError("");
    setNotice("");
    setJobId(null);
    const controller = new AbortController();
    operation.current?.abort();
    operation.current = controller;
    try {
      if (apply && (!capabilities?.canWrite || !can("content_category.publish")))
        throw Error("Bạn không có quyền áp dụng danh mục");
      let request: PublicationRequest;
      if (
        apply &&
        pending.current?.request.action === "apply-category" &&
        pending.current.fingerprint === JSON.stringify(values)
      )
        request = pending.current.request;
      else {
        const saved = await save(controller.signal);
        if (!apply) {
          setNotice("Đã lưu danh mục. Dùng Áp dụng lên website để thay đổi bản công khai.");
          return;
        }
        request = {
          action: "apply-category",
          targetId: saved.id,
          expectedRevision: saved.revision,
          idempotencyKey: crypto.randomUUID(),
        };
        pending.current = { request, fingerprint: JSON.stringify(input(saved)) };
      }
      const job = await api.publications.request(request, controller.signal);
      controller.signal.throwIfAborted();
      setJobId(job.id);
      setPublishing(!["succeeded", "failed"].includes(job.status));
    } catch (failure) {
      if (!controller.signal.aborted)
        setError(failure instanceof Error ? failure.message : "Không lưu được danh mục");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  async function remove() {
    if (!api || !record || locked) return;
    setBusy(true);
    setError("");
    setJobId(null);
    const controller = new AbortController();
    operation.current?.abort();
    operation.current = controller;
    try {
      if (record.publicRevision !== null) {
        const request: PublicationRequest =
          pending.current?.request.action === "delete-category" &&
          pending.current.request.targetId === record.id &&
          pending.current.request.expectedRevision === record.revision
            ? pending.current.request
            : {
                action: "delete-category",
                targetId: record.id,
                expectedRevision: record.revision,
                idempotencyKey: crypto.randomUUID(),
              };
        pending.current = { request, fingerprint: JSON.stringify(values) };
        const job = await api.publications.request(request, controller.signal);
        controller.signal.throwIfAborted();
        setJobId(job.id);
        setPublishing(!["succeeded", "failed"].includes(job.status));
      } else {
        await api.categories.remove(record.id, record.revision, controller.signal);
        controller.signal.throwIfAborted();
        reset(null);
        await query.refetch();
      }
      setConfirm(false);
    } catch (failure) {
      if (!controller.signal.aborted)
        setError(failure instanceof Error ? failure.message : "Không xóa được danh mục");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  const terminal = useCallback(
    (job: PublicationJob) => {
      setPublishing(false);
      if (job.status === "succeeded") {
        if (pending.current?.request.action === "delete-category") {
          reset(null);
          setNotice("Đã xóa danh mục");
        }
        void cache.invalidateQueries({ queryKey: ["bibi-admin", "content", "categories"] });
        if (record && api)
          void api.categories.get(record.id).then(
            (fresh) =>
              setRecord((current) =>
                current?.id === fresh.id
                  ? { ...current, publicRevision: fresh.publicRevision }
                  : current,
              ),
            () => {},
          );
      }
      pending.current = null;
    },
    [api, cache, record],
  );
  if (context.error) return <ErrorState error={context.error} onRetry={context.retry} />;
  if (context.pending) return <Skeleton />;
  if (!api || !can("content_category.view"))
    return <ErrorState error={new Error("Bạn không có quyền xem danh mục")} />;
  const change = <K extends keyof CategoryInput>(key: K, value: CategoryInput[K]) =>
    setValues((current) => ({ ...current, [key]: value }));
  return (
    <>
      <PageTitle
        title="Danh mục bài viết"
        description="Tối đa 3 cấp. Quan hệ cha–con không làm thay đổi URL danh mục."
      />
      {!capabilities?.canWrite && <p className="a-banner">Nội dung đang ở chế độ chỉ đọc.</p>}
      {query.error && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      <div className="a-content-layout">
        <Card>
          <Button
            disabled={dirty || locked || !capabilities?.canWrite || !can("content_category.create")}
            onClick={() => reset(null)}
          >
            Thêm danh mục
          </Button>
          {query.isPending ? (
            <Skeleton />
          ) : (
            <ul className="a-content-category-list">
              {query.data?.map((category) => (
                <li key={category.id}>
                  <Button disabled={dirty || locked} onClick={() => reset(category)}>
                    {labels.get(category.id) ?? category.name}
                  </Button>
                  {!category.active && <Badge>Đang ẩn</Badge>}
                  {category.publicRevision !== null && <Badge tone="success">Đang công khai</Badge>}
                  {category.publicRevision !== null &&
                    category.publicRevision !== category.revision && (
                      <Badge>Thay đổi chưa áp dụng</Badge>
                    )}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <form
            className="a-compose-stack"
            onSubmit={(event) => {
              event.preventDefault();
              void submit(false);
            }}
          >
            <label className="a-field">
              Tên danh mục
              <input
                required
                maxLength={300}
                value={values.name}
                disabled={!edit || locked}
                onChange={(event) => change("name", event.target.value)}
              />
            </label>
            <label className="a-field">
              Đường dẫn danh mục
              <input
                required
                maxLength={200}
                value={values.slug}
                disabled={!edit || locked}
                onChange={(event) => change("slug", event.target.value)}
              />
              <small>/blog/category/{values.slug || "duong-dan"}</small>
            </label>
            <label className="a-field">
              Danh mục cha
              <select
                value={values.parentId ?? ""}
                disabled={!edit || locked}
                onChange={(event) => change("parentId", event.target.value || null)}
              >
                {parents.map((parent) => (
                  <option
                    key={parent.id ?? "root"}
                    value={parent.id ?? ""}
                    disabled={parent.disabled}
                  >
                    {parent.label}
                    {parent.reason ? " · " + parent.reason : ""}
                  </option>
                ))}
              </select>
              <small>Danh mục tối đa 3 cấp; không thể chọn chính danh mục hoặc mục con.</small>
            </label>
            <label className="a-field">
              Mô tả
              <textarea
                value={values.description}
                maxLength={1000}
                disabled={!edit || locked}
                onChange={(event) => change("description", event.target.value)}
              />
            </label>
            <label className="a-field">
              Thứ tự
              <input
                type="number"
                min={0}
                max={1000000}
                step={1}
                value={values.position}
                disabled={!edit || locked}
                onChange={(event) => change("position", Number(event.target.value))}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={values.active}
                disabled={!edit || locked}
                onChange={(event) => change("active", event.target.checked)}
              />{" "}
              Hiển thị trong menu và lựa chọn cho bài mới
            </label>
            <label className="a-field">
              Tiêu đề SEO
              <input
                maxLength={300}
                value={values.seoTitle}
                disabled={!edit || locked}
                onChange={(event) => change("seoTitle", event.target.value)}
              />
            </label>
            <label className="a-field">
              Mô tả SEO
              <textarea
                maxLength={1000}
                value={values.seoDescription}
                disabled={!edit || locked}
                onChange={(event) => change("seoDescription", event.target.value)}
              />
            </label>
            {error && (
              <p role="alert" className="a-error">
                {error}
              </p>
            )}
            {notice && <p role="status">{notice}</p>}
            <div className="a-form-footer">
              <Button type="submit" disabled={!edit || locked}>
                Lưu danh mục
              </Button>
              {can("content_category.publish") && (
                <Button
                  disabled={!capabilities?.canWrite || locked || (!edit && (!record || dirty))}
                  variant="primary"
                  onClick={() => void submit(true)}
                >
                  Áp dụng lên website
                </Button>
              )}
              {record && can("content_category.delete") && (
                <Button
                  variant="destructive"
                  disabled={
                    !capabilities?.canWrite ||
                    locked ||
                    Boolean(record.publicRevision !== null && !can("content_category.publish"))
                  }
                  onClick={() => setConfirm(true)}
                >
                  Xóa danh mục
                </Button>
              )}
              <Button disabled={locked || !dirty} onClick={() => reset(record)}>
                Hủy thay đổi
              </Button>
            </div>
          </form>
        </Card>
      </div>
      {jobId && <PublicationStatus jobId={jobId} onTerminal={terminal} />}
      <ConfirmDialog
        open={confirm}
        title="Xóa danh mục?"
        description="Chỉ xóa khi không còn danh mục con hoặc bài viết, kể cả bản nháp và thùng rác. Thay đổi chưa lưu sẽ bị bỏ."
        onCancel={() => setConfirm(false)}
        onConfirm={() => remove()}
      />
      <ConfirmDialog
        open={blocker.status === "blocked"}
        title="Bỏ thay đổi chưa lưu?"
        description="Các thay đổi của danh mục chưa được lưu."
        onCancel={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
      />
    </>
  );
}
