import { useEffect, useMemo, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useContent } from "../context";
import { createServerMediaAdapter } from "../media/server-adapter";
import { Button, ErrorState } from "../../shared/ui/primitives";
export function ServerMediaImage({
  id,
  alt = "",
  className = "",
}: {
  id: string;
  alt?: string;
  className?: string;
}) {
  const { api } = useContent(),
    adapter = useMemo(() => (api ? createServerMediaAdapter(api.media) : null), [api]),
    [url, setUrl] = useState<string | null>(null),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let release: (() => void) | undefined;
    setUrl(null);
    setFailed(false);
    if (adapter)
      void adapter.resolve(id, controller.signal).then(
        (lease) => {
          if (controller.signal.aborted) {
            lease.release();
            return;
          }
          release = lease.release;
          setUrl(lease.url);
        },
        (error) => {
          if (error?.name !== "AbortError") setFailed(true);
        },
      );
    return () => {
      controller.abort();
      release?.();
    };
  }, [adapter, id]);
  return url ? (
    <img src={url} alt={alt} className={className} />
  ) : (
    <span role={failed ? "status" : undefined}>
      {failed ? "Không đọc được ảnh" : "Đang tải ảnh…"}
    </span>
  );
}
export function ServerMediaPicker({
  value,
  onChange,
  max = 1,
  disabled = false,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  max?: number;
  disabled?: boolean;
}) {
  const { api, can, capabilities } = useContent(),
    [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState(""),
    query = useQuery({
      queryKey: ["bibi-admin", "content", "media", page, search],
      queryFn: ({ signal }) => {
        if (!api) throw Error("API ảnh chưa sẵn sàng");
        return api.media.list({ page, pageSize: 20, search }, signal);
      },
      enabled: Boolean(api),
      retry: false,
    });
  const uploadAllowed =
    !disabled && capabilities?.canWrite && (can("post.create") || can("post.update"));
  const operation = useRef<AbortController | null>(null);
  useEffect(() => () => operation.current?.abort(), [api]);
  return (
    <section aria-label="Thư viện ảnh máy chủ">
      <label className="a-field">
        Tìm ảnh
        <input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
      </label>
      <label className="a-field">
        Tải ảnh lên
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={!uploadAllowed || uploading}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file || !api) return;
            setUploading(true);
            setError("");
            operation.current?.abort();
            const controller = new AbortController();
            operation.current = controller;
            try {
              const result = await api.media.upload(file, controller.signal);
              controller.signal.throwIfAborted();
              onChange(
                max === 1
                  ? [result.id]
                  : [...value.filter((id) => id !== result.id), result.id].slice(-max),
              );
              await query.refetch();
            } catch (failure) {
              if (!controller.signal.aborted)
                setError(failure instanceof Error ? failure.message : "Không tải được ảnh");
            } finally {
              if (!controller.signal.aborted) setUploading(false);
            }
          }}
        />
        <small>JPEG, PNG, WebP · tối đa 5 MiB, 16 MP.</small>
      </label>
      {error && (
        <p role="alert" className="a-error">
          {error}
        </p>
      )}
      {query.error && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      <div className="a-media-grid">
        {query.data?.items.map((image) => (
          <button
            key={image.id}
            type="button"
            disabled={disabled || (!value.includes(image.id) && value.length >= max && max !== 1)}
            aria-label={"Chọn " + image.originalName}
            aria-pressed={value.includes(image.id)}
            onClick={() =>
              onChange(
                value.includes(image.id)
                  ? value.filter((id) => id !== image.id)
                  : max === 1
                    ? [image.id]
                    : [...value, image.id],
              )
            }
          >
            <ServerMediaImage id={image.id} alt={image.originalName} />
            <span>{image.originalName}</span>
          </button>
        ))}
      </div>
      {value.length > 0 && (
        <div>
          <p>{value.length} ảnh đã chọn</p>
          <Button disabled={disabled} onClick={() => onChange([])}>
            Bỏ chọn ảnh
          </Button>
        </div>
      )}
      <div className="a-form-footer">
        <Button disabled={page === 1} onClick={() => setPage(page - 1)}>
          Trang trước
        </Button>
        <span>Trang {page}</span>
        <Button
          disabled={!query.data || page * 20 >= query.data.total}
          onClick={() => setPage(page + 1)}
        >
          Trang sau
        </Button>
      </div>
    </section>
  );
}
