import { useEffect, useState } from "react";
import type { AccountDto, RoleOptionDto } from "../../../../backend/src/http/contracts";
import type { AccountDraft } from "./http-api";
import { Button, Field } from "../shared/ui/primitives";

export function AccountForm({
  initial,
  roles,
  onSave,
  readOnly: requestedReadOnly = false,
  onCancel,
  onDirtyChange,
}: {
  initial?: AccountDto;
  roles: RoleOptionDto[];
  onSave: (draft: AccountDraft, revision: number) => Promise<AccountDto>;
  readOnly?: boolean;
  onCancel?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const readOnly = requestedReadOnly || Boolean(initial?.isMaster);
  const [values, setValues] = useState(() => ({
    username: initial?.username ?? "",
    displayName: initial?.displayName ?? "",
    email: initial?.email ?? "",
    password: "",
  }));
  const [roleIds, setRoleIds] = useState<string[]>(
    () =>
      initial?.roleIds ?? (roles.some((role) => role.id === "system-user") ? ["system-user"] : []),
  );
  const [revision, setRevision] = useState(initial?.revision ?? 0);
  const [baseline, setBaseline] = useState(() => JSON.stringify({ values, roleIds }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dirty = !readOnly && JSON.stringify({ values, roleIds }) !== baseline;
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  return (
    <form
      className="a-account-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (readOnly || busy) return;
        if (
          (!initial && !values.password) ||
          (values.password &&
            (values.password.length < 8 || new TextEncoder().encode(values.password).length > 72))
        ) {
          setError("Mật khẩu cần ít nhất 8 ký tự và không quá 72 byte UTF-8");
          return;
        }
        setBusy(true);
        setError("");
        try {
          const saved = await onSave(
            {
              username: values.username,
              displayName: values.displayName,
              email: values.email.trim() || null,
              ...(values.password ? { password: values.password } : {}),
              ...(!initial ? { roleIds } : {}),
            },
            revision,
          );
          const next = {
            username: saved.username,
            displayName: saved.displayName,
            email: saved.email ?? "",
            password: "",
          };
          setValues(next);
          setRevision(saved.revision);
          setRoleIds(saved.roleIds);
          setBaseline(JSON.stringify({ values: next, roleIds: saved.roleIds }));
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "Không thể lưu tài khoản");
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset
        disabled={readOnly || busy}
        style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
      >
        <div className="a-form-grid">
          <Field label="Tên tài khoản">
            <input
              value={values.username}
              autoComplete="off"
              required
              minLength={3}
              maxLength={64}
              pattern="[a-zA-Z0-9_.-]+"
              onChange={(event) => setValues({ ...values, username: event.target.value })}
            />
          </Field>
          <Field label="Tên hiển thị">
            <input
              value={values.displayName}
              required
              maxLength={160}
              onChange={(event) => setValues({ ...values, displayName: event.target.value })}
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={values.email}
              maxLength={254}
              onChange={(event) => setValues({ ...values, email: event.target.value })}
            />
          </Field>
          {!readOnly && (
            <Field
              label={initial ? "Mật khẩu mới" : "Mật khẩu"}
              description={
                initial
                  ? "Để trống nếu không đổi. Đổi mật khẩu sẽ thu hồi các phiên đăng nhập."
                  : undefined
              }
            >
              <input
                type="password"
                autoComplete="new-password"
                value={values.password}
                required={!initial}
                onChange={(event) => setValues({ ...values, password: event.target.value })}
              />
            </Field>
          )}
        </div>
        {!initial && roles.length > 0 && (
          <fieldset className="a-form-section">
            <legend>Vai trò</legend>
            {roles.map((role) => (
              <label key={role.id} className="a-checkbox">
                <input
                  type="checkbox"
                  checked={roleIds.includes(role.id)}
                  onChange={(event) =>
                    setRoleIds((current) =>
                      event.target.checked
                        ? [...current, role.id]
                        : current.filter((id) => id !== role.id),
                    )
                  }
                />{" "}
                {role.name}
              </label>
            ))}
          </fieldset>
        )}
      </fieldset>
      {initial?.isMaster && (
        <p className="a-muted">
          Tài khoản quản trị chính được bảo vệ; thông tin và phân quyền không thể thay đổi.
        </p>
      )}
      {error && (
        <p role="alert" className="a-error">
          {error}
        </p>
      )}
      {!readOnly && (
        <div className="a-form-footer">
          <Button type="submit" variant="primary" loading={busy}>
            {initial ? "Lưu thông tin" : "Tạo tài khoản"}
          </Button>
          {onCancel && (
            <Button type="button" disabled={busy} onClick={onCancel}>
              Hủy
            </Button>
          )}
        </div>
      )}
    </form>
  );
}
