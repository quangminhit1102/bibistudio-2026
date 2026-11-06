import { useEffect, useState } from "react";
import type { AccountDto, RoleOptionDto } from "../../../../backend/src/http/contracts";
import type { AccountDraft } from "./http-api";
import { Button, Field } from "../shared/ui/primitives";
import { LockKeyhole } from "lucide-react";

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
    phone: initial?.phone ?? "",
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
    if (!initial || initial.revision <= revision || dirty || busy) return;
    const next = {
      username: initial.username,
      displayName: initial.displayName,
      email: initial.email ?? "",
      phone: initial.phone ?? "",
      password: "",
    };
    setValues(next);
    setRoleIds(initial.roleIds);
    setRevision(initial.revision);
    setBaseline(JSON.stringify({ values: next, roleIds: initial.roleIds }));
    setError("");
  }, [initial, revision, dirty, busy]);
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  return (
    <form
      className="a-account-form"
      data-readonly={readOnly}
      onSubmit={async (event) => {
        event.preventDefault();
        if (readOnly || busy || (initial && !dirty)) return;
        if (
          (!initial && !values.password) ||
          (values.password &&
            (values.password.length < 8 || new TextEncoder().encode(values.password).length > 72))
        ) {
          setError("Mật khẩu cần ít nhất 8 ký tự và không quá 72 byte UTF-8");
          return;
        }
        const phone = values.phone.trim().replace(/[ ()-]/g, "");
        if (values.phone.length > 32 || (phone && !/^\+?\d{7,15}$/.test(phone))) {
          setError("Số điện thoại cần 7–15 chữ số, có thể bắt đầu bằng +");
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
              phone: phone || null,
              ...(values.password ? { password: values.password } : {}),
              ...(!initial ? { roleIds } : {}),
            },
            revision,
          );
          const next = {
            username: saved.username,
            displayName: saved.displayName,
            email: saved.email ?? "",
            phone: saved.phone ?? "",
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
      <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <div className="a-form-grid">
          <Field label="Tên tài khoản">
            <input
              value={values.username}
              readOnly={readOnly}
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
              readOnly={readOnly}
              required
              maxLength={160}
              onChange={(event) => setValues({ ...values, displayName: event.target.value })}
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={values.email}
              readOnly={readOnly}
              maxLength={254}
              onChange={(event) => setValues({ ...values, email: event.target.value })}
            />
          </Field>
          <Field label="Số điện thoại">
            <input
              type="tel"
              value={values.phone}
              readOnly={readOnly}
              maxLength={32}
              onChange={(event) => setValues({ ...values, phone: event.target.value })}
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
                  disabled={readOnly}
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
      {readOnly && (
        <div className="a-readonly-note">
          <LockKeyhole size={17} aria-hidden />
          <div>
            <strong>
              {initial?.isMaster
                ? "Tài khoản quản trị gốc được bảo vệ"
                : "Bạn chỉ có quyền xem thông tin tài khoản."}
            </strong>
            {initial?.isMaster && (
              <p>Thông tin và phân quyền của tài khoản này không thể thay đổi.</p>
            )}
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="a-error">
          {error}
        </p>
      )}
      {(!readOnly || onCancel) && (
        <div className="a-form-footer">
          {!readOnly && (
            <Button
              type="submit"
              variant="primary"
              loading={busy}
              disabled={Boolean(initial) && !dirty}
            >
              {initial ? "Lưu thông tin" : "Tạo tài khoản"}
            </Button>
          )}
          {!readOnly && initial && !dirty && <span className="a-muted">Chưa có thay đổi</span>}
          {onCancel && (
            <Button type="button" disabled={busy} onClick={onCancel}>
              {readOnly ? "Quay lại" : "Hủy"}
            </Button>
          )}
        </div>
      )}
    </form>
  );
}
