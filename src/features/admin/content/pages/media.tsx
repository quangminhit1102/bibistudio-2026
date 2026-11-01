import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAdmin, useEntity, useRole } from "../../services/context";
import { can } from "../../accounts/permissions";
import { createMediaService } from "../media/service";
import { MediaImage } from "../components/media-image";
import {
  PageTitle,
  Button,
  Card,
  ConfirmDialog,
  Modal,
  ErrorState,
  Skeleton,
  EmptyState,
  useNotice,
} from "../../shared/ui/primitives";
import type { MediaAsset } from "../../services/contracts";
export default function Media() {
  const runtime = useAdmin();
  const role = useRole();
  const client = useQueryClient();
  const notice = useNotice();
  const fileInput = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [mode, setMode] = useState<"grid" | "list">("grid");
  const [selected, setSelected] = useState<string[]>([]);
  const [preview, setPreview] = useState<MediaAsset | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const result = useEntity("media", {
    page: 1,
    pageSize: 200,
    search,
    filters: type ? { mime: type } : {},
  });
  const allowed = (action: "create" | "delete") =>
    can(runtime.session, "content", action, role.data);
  const upload = async (files: File[]) => {
    setBusy(true);
    try {
      const added = await createMediaService(runtime.store, () => runtime.session).import(files);
      await client.invalidateQueries({ queryKey: ["bibi-admin", "media"] });
      notice(`Đã nhập ${added.length} ảnh vào trình duyệt.`);
    } catch (e) {
      notice(e instanceof Error ? e.message : "Lưu ảnh thất bại", "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageTitle
        title="Thư viện ảnh"
        description="Tài nguyên lưu bằng IndexedDB. Ảnh chỉ có trên trình duyệt này, không được upload server."
        actions={
          <Button
            variant="primary"
            loading={busy}
            disabled={!allowed("create")}
            onClick={() => fileInput.current?.click()}
          >
            Nhập ảnh cục bộ
          </Button>
        }
      />
      <input
        hidden
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={(e) => {
          void upload(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      <div
        className="a-dropzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (allowed("create")) void upload(Array.from(e.dataTransfer.files));
        }}
      >
        <p>Kéo ảnh vào đây hoặc dùng nút Nhập ảnh</p>
        <small>JPEG · PNG · WebP · tối đa5MiB/ảnh,10 ảnh/lần,40 megapixel.</small>
      </div>
      <div className="a-toolbar">
        <input
          placeholder="Tìm tên ảnh…"
          aria-label="Tìm ảnh"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select aria-label="Định dạng ảnh" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Mọi định dạng</option>
          {["image/jpeg", "image/png", "image/webp"].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <Button onClick={() => setMode(mode === "grid" ? "list" : "grid")}>
          {mode === "grid" ? "Xem danh sách" : "Xem dạng lưới"}
        </Button>
        {selected.length > 0 && (
          <Button
            variant="destructive"
            disabled={!allowed("delete")}
            onClick={() => setConfirm(true)}
          >
            Xóa {selected.length} ảnh
          </Button>
        )}
      </div>
      {result.isPending ? (
        <Skeleton />
      ) : result.error ? (
        <ErrorState error={result.error} onRetry={() => void result.refetch()} />
      ) : !result.data?.total ? (
        <EmptyState
          title="Thư viện đang trống"
          description="Nhập ảnh để dùng trong sản phẩm, sách và bài viết demo."
        />
      ) : (
        <div className={mode === "grid" ? "a-media-grid" : "a-media-list"}>
          {result.data.items.map((asset) => (
            <div className="a-media-item" key={asset.id}>
              <button aria-label={`Xem ${asset.name}`} onClick={() => setPreview(asset)}>
                <MediaImage id={asset.id} alt={asset.name} />
              </button>
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={selected.includes(asset.id)}
                    onChange={(e) =>
                      setSelected((v) =>
                        e.target.checked ? [...v, asset.id] : v.filter((id) => id !== asset.id),
                      )
                    }
                  />
                  <strong>{asset.name}</strong>
                </label>
                <small>
                  {asset.width}×{asset.height} · {(asset.size / 1024).toFixed(0)}KiB
                </small>
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal
        open={!!preview}
        onOpenChange={(v) => {
          if (!v) setPreview(null);
        }}
        title={preview?.name ?? "Ảnh"}
        wide
      >
        <div className="a-dialog-body">
          {preview && (
            <>
              <MediaImage id={preview.id} alt={preview.name} className="a-media-preview" />
              <p style={{ marginTop: 12 }}>
                {preview.mime} · {preview.width}×{preview.height} ·{" "}
                {preview.size.toLocaleString("vi-VN")} bytes
              </p>
            </>
          )}
        </div>
      </Modal>
      <ConfirmDialog
        open={confirm}
        title="Xóa ảnh đã chọn?"
        description="Ảnh đang dùng trong sản phẩm/bài viết sẽ được giữ lại."
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          let count = 0;
          const failures = [];
          for (const id of selected) {
            try {
              const record = await runtime.service("media").get(id);
              await runtime.service("media").remove(id, record.revision);
              await runtime.store.removeBlob(record.blobKey);
              count++;
            } catch (e) {
              failures.push(e instanceof Error ? e.message : "Không thể xóa");
            }
          }
          await client.invalidateQueries({ queryKey: ["bibi-admin", "media"] });
          setSelected([]);
          if (failures.length) throw new Error(`Đã xóa ${count} ảnh; ${failures[0]}`);
          notice(`Đã xóa ${count} ảnh.`);
        }}
      />
    </>
  );
}
