import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { ArrowLeft, Eye, Save } from "lucide-react";
import { Button, Card, PageTitle, Skeleton } from "../ui/primitives";
import { EditorFields } from "./editor-fields";
import { normalizeSearch } from "../lib/text";
import { postConfig } from "../../content/config";
import { productConfig } from "../../products/config";
import type { FormValues } from "./record-form";
import EditorPreview, { type EditorSnapshot } from "./editor-preview";
const RichEditor = lazy(() => import("../../content/components/rich-editor"));
const MediaPicker = lazy(() => import("../../content/components/media-picker"));
const ProductGallery = lazy(() => import("../../products/components/product-gallery"));
export interface ComposeFormProps {
  initial: FormValues;
  onSave: (values: FormValues) => Promise<unknown> | unknown;
  onCancel: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  writeBlocked?: boolean;
}

export default function ComposeForm({
  initial,
  onSave,
  onCancel,
  onDirtyChange,
  kind,
  writeBlocked = false,
}: { kind: "post" | "product" } & ComposeFormProps) {
  const post = kind === "post",
    config = post ? postConfig : productConfig;
  const methods = useForm<FormValues>({ defaultValues: initial });
  const {
    watch,
    control,
    setValue,
    handleSubmit,
    formState: { isDirty },
  } = methods;
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [ready, setReady] = useState(false);
  const [preview, setPreview] = useState<EditorSnapshot | null>(null);
  const manualSlug = useRef(Boolean(initial.id) || Boolean(initial.slug));
  const name = watch(post ? "title" : "name");
  const bodyKey = post ? "content" : "description";
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);
  useEffect(() => {
    if (!manualSlug.current)
      setValue(
        "slug",
        normalizeSearch(String(name ?? ""))
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, ""),
        { shouldDirty: true },
      );
  }, [name, setValue]);
  const fields = (keys: string[]) => (
    <EditorFields
      fields={config.fields}
      keys={keys}
      onSlugEdit={() => {
        manualSlug.current = true;
      }}
    />
  );
  const save = (draft: boolean) =>
    handleSubmit(async (values) => {
      if (writeBlocked) {
        setError("Không thể lưu lúc này. Bản nháp vẫn được giữ trong form.");
        return;
      }
      if (!ready) {
        setError("Trình biên tập chưa sẵn sàng. Vui lòng thử lại.");
        return;
      }
      setBusy(true);
      setError("");
      try {
        await onSave({ ...values, ...(draft ? { status: "draft" } : {}) });
        methods.reset({ ...values, ...(draft ? { status: "draft" } : {}) });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Không thể lưu dữ liệu.");
      } finally {
        setBusy(false);
      }
    });
  return (
    <FormProvider {...methods}>
      <form className="a-compose" onSubmit={save(false)} noValidate>
        <PageTitle
          title={`${initial.id ? "Chỉnh sửa" : "Thêm"} ${post ? "bài viết" : "sản phẩm"}`}
          description={
            post
              ? "Biên tập câu chuyện, hình ảnh và cách bài viết xuất hiện."
              : "Hoàn thiện hình ảnh và câu chuyện của sản phẩm."
          }
          actions={
            <>
              <Button disabled={busy} onClick={onCancel}>
                <ArrowLeft size={16} />
                Quay lại
              </Button>
              <Button
                onClick={() => setPreview({ kind, record: structuredClone(methods.getValues()) })}
              >
                <Eye size={16} />
                Xem trước
              </Button>
              <Button disabled={busy || !ready || writeBlocked} onClick={() => void save(true)()}>
                Lưu nháp
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={!ready || writeBlocked}
                loading={busy}
              >
                <Save size={16} />
                {initial.id ? "Lưu thay đổi" : post ? "Tạo bài viết" : "Tạo sản phẩm"}
              </Button>
            </>
          }
        />
        {error && (
          <p role="alert" className="a-compose-error">
            {error}
          </p>
        )}
        <fieldset disabled={busy || writeBlocked} className="a-compose-layout">
          <legend className="a-sr-only">{post ? "Biên tập bài viết" : "Biên tập sản phẩm"}</legend>
          <div className="a-compose-stack">
            <Card>
              <div className="a-compose-stack">
                {fields(
                  post ? ["title", "slug", "excerpt"] : ["name", "sku", "slug", "shortDescription"],
                )}
              </div>
            </Card>
            {!post && (
              <Card>
                <h2>Ảnh sản phẩm</h2>
                <p className="a-compose-hint">
                  Ảnh đầu tiên là ảnh chính. Sắp xếp bằng các nút mũi tên.
                </p>
                <Controller
                  name="imageIds"
                  control={control}
                  render={({ field }) => (
                    <Suspense fallback={<Skeleton />}>
                      <ProductGallery
                        value={Array.isArray(field.value) ? field.value : []}
                        onChange={field.onChange}
                      />
                    </Suspense>
                  )}
                />
              </Card>
            )}
            <Card>
              <h2>{post ? "Nội dung bài viết" : "Mô tả chi tiết"}</h2>
              <div className="a-compose-body">
                <Controller
                  name={bodyKey}
                  control={control}
                  render={({ field }) => (
                    <Suspense fallback={<Skeleton rows={5} />}>
                      <RichEditor
                        disabled={busy || writeBlocked}
                        value={String(field.value ?? "")}
                        onChange={field.onChange}
                        scope={post ? "content" : "products"}
                        label={post ? "Nội dung bài viết" : "Mô tả chi tiết sản phẩm"}
                        onReadyChange={setReady}
                      />
                    </Suspense>
                  )}
                />
              </div>
            </Card>
            {!post && (
              <details className="a-compose-details">
                <summary>Thông tin nội bộ</summary>
                <p className="a-compose-hint">
                  Phục vụ quản lý; không hiển thị trong catalogue sản phẩm.
                </p>
                <div className="a-compose-fields">{fields(["price", "compareAt", "stock"])}</div>
              </details>
            )}
            <details className="a-compose-details">
              <summary>Thiết lập SEO</summary>
              <div className="a-compose-stack">{fields(["seoTitle", "seoDescription"])}</div>
            </details>
          </div>
          <aside className="a-compose-stack">
            <Card>
              <h2>{post ? "Thông tin bài viết" : "Phân loại & hiển thị"}</h2>
              <div className="a-compose-stack a-compose-card-fields">
                {fields(
                  post
                    ? ["status", "categoryId", "authorId", "publishAt", "tagIds"]
                    : ["status", "productType", "collection", "categoryId", "tags"],
                )}
              </div>
            </Card>
            {post && (
              <Card>
                <h2>Ảnh bìa</h2>
                <p className="a-compose-hint">Dùng trên thẻ bài viết và đầu trang chi tiết.</p>
                <Controller
                  name="imageId"
                  control={control}
                  render={({ field }) => (
                    <Suspense fallback={<Skeleton rows={2} />}>
                      <MediaPicker
                        max={1}
                        scope="content"
                        value={field.value ? [String(field.value)] : []}
                        onChange={(ids) => field.onChange(ids[0] ?? null)}
                      />
                    </Suspense>
                  )}
                />
              </Card>
            )}
            <p className="a-compose-note">
              Xem trước sử dụng nội dung đang nhập, bao gồm thay đổi chưa lưu.
            </p>
          </aside>
        </fieldset>
      </form>
      {preview && (
        <EditorPreview
          open
          onOpenChange={(open) => {
            if (!open) setPreview(null);
          }}
          snapshot={preview}
        />
      )}
    </FormProvider>
  );
}
