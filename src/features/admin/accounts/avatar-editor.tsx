import { useEffect, useRef, useState } from "react";
import type { ProfileDto } from "../../../../backend/src/profile/types";
import { ServerAvatar } from "./server-avatar";
import type { createProfileApi } from "./profile-api";
import { Button } from "../shared/ui/primitives";
export function AvatarEditor({
  user,
  api,
  onSaved,
  metadataDirty,
  onDirtyChange,
  onBusyChange,
  readOnly = false,
}: {
  user: ProfileDto;
  api: Pick<ReturnType<typeof createProfileApi>, "upload" | "remove">;
  onSaved: (p: ProfileDto) => void | Promise<void>;
  metadataDirty: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
  readOnly?: boolean;
}) {
  const [file, setFile] = useState<File>(),
    [preview, setPreview] = useState<string>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null),
    mounted = useRef(true),
    controller = useRef<AbortController | undefined>(undefined);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!file) {
      setPreview(undefined);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    onDirtyChange?.(!!file);
  }, [file, onDirtyChange]);
  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);
  const locked = user.isMaster || readOnly,
    disabled = locked || metadataDirty || busy;
  const clear = () => {
    setFile(undefined);
    if (input.current) input.current.value = "";
  };
  async function save(remove = false) {
    if (disabled) return;
    setBusy(true);
    setError("");
    controller.current = new AbortController();
    try {
      const saved = remove
        ? await api.remove(user.revision)
        : await api.upload(file!, user.revision, controller.current.signal);
      if (!mounted.current) return;
      clear();
      await onSaved(saved);
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "Không thể lưu ảnh");
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <section className="a-avatar-editor" aria-label="Ảnh đại diện">
      <div className="a-avatar-editor-photo">
        {preview ? (
          <img src={preview} alt="Xem trước ảnh đại diện" width={88} height={88} />
        ) : (
          <ServerAvatar user={user} size={88} />
        )}
      </div>
      <div className="a-avatar-editor-info">
        <h2>Ảnh đại diện</h2>
        <p className="a-avatar-editor-name">{user.displayName}</p>
        <p className="a-muted a-avatar-editor-hint">
          {locked
            ? "Ảnh đại diện ở chế độ chỉ xem."
            : "JPEG/PNG, tối đa 2 MiB và 16 triệu điểm ảnh. Ảnh được thu về tối đa 512 × 512."}
        </p>
        {file && (
          <p className="a-avatar-editor-file a-muted" role="status">
            {file.name}
          </p>
        )}
        {metadataDirty && !locked && (
          <p className="a-muted a-avatar-editor-hint">
            Lưu hoặc hoàn tác thông tin trước khi thay đổi ảnh.
          </p>
        )}
        {error && (
          <p role="alert" className="a-error">
            {error}
          </p>
        )}
      </div>
      {!locked && (
        <div className="a-avatar-editor-actions">
          <input
            ref={input}
            aria-label="Chọn ảnh đại diện"
            type="file"
            hidden
            accept="image/jpeg,image/png"
            disabled={disabled}
            onChange={(e) => {
              const next = e.target.files?.[0];
              setError("");
              if (!next) {
                clear();
                return;
              }
              if (!["image/jpeg", "image/png"].includes(next.type) || next.size > 2097152) {
                setError("Dùng ảnh JPEG/PNG tối đa 2 MiB");
                e.target.value = "";
                return;
              }
              setFile(next);
            }}
          />
          {file ? (
            <>
              <Button
                variant="primary"
                disabled={disabled}
                loading={busy}
                onClick={() => void save()}
              >
                Lưu ảnh
              </Button>
              <Button disabled={busy} onClick={clear}>
                Hủy chọn ảnh
              </Button>
            </>
          ) : (
            <>
              <Button disabled={disabled} onClick={() => input.current?.click()}>
                Chọn ảnh
              </Button>
              {user.avatarId && (
                <Button
                  variant="ghost"
                  className="a-avatar-editor-remove"
                  disabled={disabled}
                  onClick={() => void save(true)}
                >
                  Xóa ảnh
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
