import { useEffect, useState } from "react";
import type { ProfileDto } from "../../../../backend/src/profile/types";
import type { ProfileDraft } from "./profile-api";
import { Button, Field } from "../shared/ui/primitives";
import { RefreshButton } from "../shared/ui/refresh-button";
const values = (p: ProfileDto) => ({
  displayName: p.displayName,
  email: p.email ?? "",
  phone: p.phone ?? "",
});
export function SelfProfileForm({
  initial,
  onSave,
  onDirtyChange,
  onBusyChange,
  onReload,
  blocked = false,
}: {
  initial: ProfileDto;
  onSave: (draft: ProfileDraft, revision: number) => Promise<ProfileDto>;
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
  onReload?: () => void;
  blocked?: boolean;
}) {
  const [draft, setDraft] = useState(() => values(initial)),
    [baseline, setBaseline] = useState(() => JSON.stringify(values(initial))),
    [revision, setRevision] = useState(initial.revision),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const dirty = JSON.stringify(draft) !== baseline;
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);
  useEffect(() => {
    if (busy || initial.revision <= revision) return;
    if (!dirty) {
      setDraft(values(initial));
      setBaseline(JSON.stringify(values(initial)));
      setRevision(initial.revision);
    } else if (JSON.stringify(values(initial)) === baseline) {
      // Only something outside this form changed (avatar, password): the edits still apply.
      setRevision(initial.revision);
    }
  }, [initial, revision, dirty, busy, baseline]);
  return (
    <form
      className="a-account-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!dirty || busy || blocked) return;
        const phone = draft.phone.trim().replace(/[ ()-]/g, "");
        if (draft.phone.length > 32 || (phone && !/^\+?\d{7,15}$/.test(phone))) {
          setError("Số điện thoại cần 7–15 chữ số, có thể bắt đầu bằng +");
          return;
        }
        setBusy(true);
        setError("");
        try {
          const saved = await onSave(
            {
              displayName: draft.displayName.trim(),
              email: draft.email.trim() || null,
              phone: phone || null,
            },
            revision,
          );
          const next = values(saved);
          setDraft(next);
          setBaseline(JSON.stringify(next));
          setRevision(saved.revision);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "Không thể lưu hồ sơ");
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset
        disabled={busy || blocked}
        style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
      >
        <div className="a-form-grid">
          <Field label="Tên tài khoản">
            <input value={initial.username} readOnly autoComplete="username" />
          </Field>
          <Field label="Tên hiển thị">
            <input
              value={draft.displayName}
              required
              maxLength={160}
              onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={draft.email}
              maxLength={254}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            />
          </Field>
          <Field label="Số điện thoại">
            <input
              type="tel"
              value={draft.phone}
              maxLength={32}
              autoComplete="tel"
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
            />
          </Field>
        </div>
      </fieldset>
      <div className="a-form-footer">
        <Button variant="primary" type="submit" disabled={!dirty || blocked} loading={busy}>
          Lưu thông tin
        </Button>
        <Button
          type="button"
          disabled={!dirty || busy || blocked}
          onClick={() => {
            setDraft(values(initial));
            setBaseline(JSON.stringify(values(initial)));
            setRevision(initial.revision);
            setError("");
          }}
        >
          Hoàn tác
        </Button>
      </div>
      {error && (
        <div role="alert" className="a-error">
          {error}
          {onReload && <RefreshButton disabled={busy || blocked} onClick={onReload} />}
        </div>
      )}
    </form>
  );
}
