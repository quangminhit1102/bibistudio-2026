import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAdmin, useEntity } from "../../services/context";
import { createMediaService } from "../media/service";
import { MediaImage } from "./media-image";
import { Button, Modal, Skeleton, ErrorState, useNotice } from "../../shared/ui/primitives";
export default function MediaPicker({
  value,
  onChange,
  max = 10,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  max?: number;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const runtime = useAdmin();
  const query = useQueryClient();
  const notice = useNotice();
  const input = useRef<HTMLInputElement>(null);
  const media = useEntity("media", { page: 1, pageSize: 200 });
  const upload = async (files: File[]) => {
    setBusy(true);
    try {
      if (value.length + files.length > max)
        throw new Error(`Tối đa ${max} ảnh. Xóa ảnh đang chọn trước khi thêm ảnh mới.`);
      const added = await createMediaService(runtime.store, () => runtime.session).import(files);
      if (value.length + added.length > max)
        throw new Error("Tối đa10 ảnh cho một sản phẩm. Ảnh đã nhập nằm trong thư viện.");
      onChange([...value, ...added.map((a) => a.id)]);
      await query.invalidateQueries({ queryKey: ["bibi-admin", "media"] });
      notice("Đã lưu ảnh cục bộ.");
    } catch (e) {
      notice(e instanceof Error ? e.message : "Không thể nhập ảnh", "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="a-actions">
        <Button onClick={() => setOpen(true)}>Chọn từ thư viện</Button>
        <Button loading={busy} onClick={() => input.current?.click()}>
          Nhập ảnh cục bộ
        </Button>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          onChange={(e) => {
            void upload(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>
      <small>JPEG, PNG, WebP · tối đa5MiB/ảnh · lưu trong trình duyệt, không upload server.</small>
      <div className="a-demo-gallery">
        {value.map((id) => (
          <div key={id}>
            <MediaImage id={id} alt="Ảnh đã chọn" />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onChange(value.filter((v) => v !== id))}
            >
              Bỏ ảnh
            </Button>
          </div>
        ))}
      </div>
      <Modal open={open} onOpenChange={setOpen} title="Thư viện ảnh" wide>
        <div className="a-dialog-body">
          {media.isPending ? (
            <Skeleton />
          ) : media.error ? (
            <ErrorState error={media.error} onRetry={() => void media.refetch()} />
          ) : (
            <div className="a-media-grid">
              {media.data?.items.map((asset) => (
                <button
                  type="button"
                  className="a-media-item"
                  aria-pressed={value.includes(asset.id)}
                  key={asset.id}
                  onClick={() => {
                    if (value.includes(asset.id)) onChange(value.filter((v) => v !== asset.id));
                    else if (value.length < max) onChange([...value, asset.id]);
                  }}
                >
                  <MediaImage id={asset.id} alt={asset.name} />
                  <div>
                    <strong>{asset.name}</strong>
                    <small>{value.includes(asset.id) ? "Đã chọn" : "Chọn ảnh"}</small>
                  </div>
                </button>
              ))}
            </div>
          )}
          <div className="a-form-footer">
            <Button onClick={() => setOpen(false)}>Xong</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
