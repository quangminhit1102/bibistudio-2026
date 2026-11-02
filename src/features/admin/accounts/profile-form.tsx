import { useEffect, useRef, useState } from "react";
import type { AdminUser, AvatarChange } from "../services/contracts";
import { Button, Field, ConfirmDialog } from "../shared/ui/primitives";
import { UnsavedDialog } from "../shared/forms/preference-form";
import { ProfileAvatar } from "./account-avatar";
import { prepareAvatar } from "./profile-avatar";
export function ProfileForm({
  user,
  onSave,
}: {
  user: AdminUser;
  onSave: (
    values: { name: string; email: string },
    revision: number,
    avatar: AvatarChange,
  ) => Promise<AdminUser>;
}) {
  const [baseline, setBaseline] = useState(user),
    [name, setName] = useState(user.name),
    [email, setEmail] = useState(user.email);
  const [avatar, setAvatar] = useState<AvatarChange>({ kind: "keep" }),
    [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false),
    [validating, setValidating] = useState(false),
    [error, setError] = useState(""),
    [discard, setDiscard] = useState(false);
  const sequence = useRef(0),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      sequence.current++;
    };
  }, []);
  useEffect(() => {
    if (avatar.kind !== "replace") {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(avatar.file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatar]);
  const dirty = name !== baseline.name || email !== baseline.email || avatar.kind !== "keep";
  const reset = () => {
    sequence.current++;
    setValidating(false);
    setName(baseline.name);
    setEmail(baseline.email);
    setAvatar({ kind: "keep" });
    setError("");
    setDiscard(false);
  };
  return (
    <>
      <form
        className="a-profile-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy || validating) return;
          setBusy(true);
          setError("");
          try {
            const saved = await onSave({ name, email }, baseline.revision, avatar);
            if (mounted.current) {
              setBaseline(saved);
              setName(saved.name);
              setEmail(saved.email);
              setAvatar({ kind: "keep" });
            }
          } catch (e) {
            if (mounted.current) setError(e instanceof Error ? e.message : "Không thể lưu hồ sơ.");
          } finally {
            if (mounted.current) setBusy(false);
          }
        }}
      >
        <div className="a-profile-photo">
          {preview ? (
            <img src={preview} alt="Ảnh đại diện đã chọn" />
          ) : (
            <ProfileAvatar
              user={{
                ...baseline,
                name,
                avatar: avatar.kind === "remove" ? null : baseline.avatar,
              }}
              size={80}
            />
          )}
          <div>
            <Field label="Chọn ảnh đại diện">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={busy}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  const ticket = ++sequence.current;
                  setValidating(true);
                  setError("");
                  try {
                    await prepareAvatar(file);
                    if (mounted.current && ticket === sequence.current)
                      setAvatar({ kind: "replace", file });
                  } catch (e) {
                    if (mounted.current && ticket === sequence.current)
                      setError(e instanceof Error ? e.message : "Ảnh không hợp lệ.");
                  } finally {
                    if (mounted.current && ticket === sequence.current) setValidating(false);
                  }
                }}
              />
            </Field>
            <small>JPEG, PNG hoặc WebP · Tối đa5MiB, 40 triệu pixel</small>
            <Button
              type="button"
              variant="ghost"
              disabled={busy || validating || (!baseline.avatar && avatar.kind !== "replace")}
              onClick={() => {
                sequence.current++;
                setAvatar({ kind: "remove" });
              }}
            >
              Xóa ảnh
            </Button>
          </div>
        </div>
        <Field label="Họ tên">
          <input
            required
            maxLength={200}
            value={name}
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            required
            value={email}
            disabled={busy}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        {error && (
          <p className="a-error" role="alert">
            {error}
          </p>
        )}
        {validating && <p role="status">Đang kiểm tra ảnh…</p>}
        <div className="a-actions">
          <Button type="submit" variant="primary" loading={busy} disabled={validating || !dirty}>
            Lưu hồ sơ
          </Button>
          <Button type="button" disabled={busy || !dirty} onClick={() => setDiscard(true)}>
            Hủy thay đổi
          </Button>
        </div>
      </form>
      <UnsavedDialog dirty={dirty} />
      <ConfirmDialog
        open={discard}
        title="Bỏ thay đổi chưa lưu?"
        description="Khôi phục hồ sơ đã lưu."
        onCancel={() => setDiscard(false)}
        onConfirm={reset}
      />
    </>
  );
}
