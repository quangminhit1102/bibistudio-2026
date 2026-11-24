import { useRef, useState } from "react";
import { Button, Field } from "../shared/ui/primitives";

const empty = { current: "", next: "", again: "" };
/** The same rule as the server: 8 characters at least, 72 UTF-8 bytes at most, nothing trimmed. */
function refusal({ current, next, again }: typeof empty): string {
  if (next.length < 8) return "Mật khẩu mới cần ít nhất 8 ký tự";
  if (new TextEncoder().encode(next).length > 72) return "Mật khẩu mới quá dài";
  if (next !== again) return "Hai ô mật khẩu mới không khớp";
  if (next === current) return "Mật khẩu mới phải khác mật khẩu hiện tại";
  return "";
}
export function PasswordForm({
  onChange,
}: {
  onChange: (currentPassword: string, newPassword: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(empty),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const sending = useRef(false);
  const filled = !!draft.current && !!draft.next && !!draft.again;
  const input = (key: keyof typeof empty, autoComplete: string) => (
    <input
      type="password"
      value={draft[key]}
      autoComplete={autoComplete}
      onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
    />
  );
  return (
    <form
      className="a-account-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!filled || sending.current) return;
        const problem = refusal(draft);
        setError(problem);
        if (problem) return;
        sending.current = true;
        setBusy(true);
        try {
          await onChange(draft.current, draft.next);
          setDraft(empty);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "Không thể đổi mật khẩu");
        } finally {
          sending.current = false;
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <div className="a-form-grid">
          <Field label="Mật khẩu hiện tại">{input("current", "current-password")}</Field>
          <Field label="Mật khẩu mới">{input("next", "new-password")}</Field>
          <Field label="Nhập lại mật khẩu mới">{input("again", "new-password")}</Field>
        </div>
        <p className="a-muted">
          Mật khẩu mới cần ít nhất 8 ký tự. Sau khi đổi, các thiết bị khác sẽ bị đăng xuất.
        </p>
      </fieldset>
      <div className="a-form-footer">
        <Button variant="primary" type="submit" disabled={!filled} loading={busy}>
          Đổi mật khẩu
        </Button>
      </div>
      {error && (
        <div role="alert" className="a-error">
          {error}
        </div>
      )}
    </form>
  );
}
