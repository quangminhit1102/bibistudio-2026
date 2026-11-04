import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { PermissionDto, RoleDto } from "../../../../backend/src/http/contracts";
import { useAdmin } from "../services/context";
import { useAccountApi } from "./server-hooks";
import { canCode } from "./permissions";
import {
  Button,
  Card,
  ConfirmDialog,
  ErrorState,
  Field,
  PageTitle,
  Skeleton,
  useNotice,
} from "../shared/ui/primitives";
import { UnsavedDialog } from "../shared/forms/preference-form";
const resourceNames: Record<string, string> = {
  account: "Tài khoản",
  role: "Vai trò",
  permission: "Phân quyền",
  customer_access: "Khách truy cập",
  dashboard: "Bảng điều khiển",
  audit: "Nhật ký hệ thống",
  product: "Sản phẩm",
  customer: "Khách mua hàng",
  sales_slip: "Kinh doanh",
  post: "Nội dung",
  notification: "Thông báo",
  settings: "Cài đặt",
  components: "Thành phần giao diện",
};

function PermissionEditor({
  role,
  permissions,
  onDirtyChange,
}: {
  role: RoleDto;
  permissions: PermissionDto[];
  onDirtyChange: (value: boolean) => void;
}) {
  const runtime = useAdmin();
  const api = useAccountApi();
  const cache = useQueryClient();
  const notice = useNotice();
  const [selected, setSelected] = useState(role.permissionIds);
  const [baseline, setBaseline] = useState(role.permissionIds);
  const [revision, setRevision] = useState(role.revision);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selfRole =
    runtime.session?.kind === "http" &&
    runtime.session.principal.roleIds.includes(role.id) &&
    !runtime.session.principal.fullAccess;
  const readonly =
    role.fullAccess || selfRole || !canCode(runtime.session, "role.assign_permission");
  const dirty = !readonly && [...selected].sort().join() !== [...baseline].sort().join();
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty && role.revision > revision) {
      setSelected(role.permissionIds);
      setBaseline(role.permissionIds);
      setRevision(role.revision);
    }
  }, [dirty, role.revision, role.permissionIds, revision]);
  const groups = new Map<string, PermissionDto[]>();
  for (const permission of permissions) {
    const key = permission.code.split(".")[0];
    groups.set(key, [...(groups.get(key) ?? []), permission]);
  }
  return (
    <Card>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (readonly || busy || !dirty) return;
          setBusy(true);
          setError("");
          try {
            const saved = await api.setRolePermissions({ ...role, revision }, selected);
            setRevision(saved.revision);
            setSelected(saved.permissionIds);
            setBaseline(saved.permissionIds);
            onDirtyChange(false);
            await cache.invalidateQueries({ queryKey: ["bibi-admin", "http-roles"] });
            notice("Đã lưu phân quyền và thu hồi các phiên cũ");
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Không thể lưu phân quyền");
          } finally {
            setBusy(false);
          }
        }}
      >
        {role.fullAccess && (
          <p>Vai trò quản trị có đầy đủ quyền, bao gồm chức năng được bổ sung sau này.</p>
        )}
        {selfRole && <p>Bạn không thể tự thay đổi quyền của vai trò đang sử dụng.</p>}
        <div className="a-permission-picker">
          {[...groups].map(([resource, items]) => (
            <fieldset key={resource} className="a-role-options" disabled={readonly || busy}>
              <legend>{resourceNames[resource] ?? resource}</legend>
              {items.map((permission) => (
                <label className="a-checkbox" key={permission.id} title={permission.code}>
                  <input
                    type="checkbox"
                    checked={role.fullAccess || selected.includes(permission.id)}
                    disabled={!canCode(runtime.session, permission.code)}
                    onChange={(event) =>
                      setSelected((current) =>
                        event.target.checked
                          ? [...current, permission.id]
                          : current.filter((id) => id !== permission.id),
                      )
                    }
                  />{" "}
                  {permission.description}
                </label>
              ))}
            </fieldset>
          ))}
        </div>
        {error && (
          <p className="a-error" role="alert">
            {error}
          </p>
        )}
        {!readonly && (
          <div className="a-form-footer">
            <Button type="submit" variant="primary" disabled={!dirty} loading={busy}>
              Lưu phân quyền
            </Button>
          </div>
        )}
        <UnsavedDialog dirty={dirty} />
      </form>
    </Card>
  );
}
export function ServerPermissions() {
  const runtime = useAdmin();
  const api = useAccountApi();
  const [id, setId] = useState("");
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const roles = useQuery({
    queryKey: ["bibi-admin", "http-roles", runtime.session?.userId],
    enabled: canCode(runtime.session, "role.view"),
    queryFn: ({ signal }) => api.roles(signal),
  });
  const permissions = useQuery({
    queryKey: ["bibi-admin", "http-permissions", runtime.session?.userId],
    enabled: canCode(runtime.session, "permission.view"),
    queryFn: ({ signal }) => api.permissions(signal),
  });
  if (runtime.sessionLoading) return <Skeleton />;
  if (!canCode(runtime.session, "role.view") || !canCode(runtime.session, "permission.view"))
    return <ErrorState error={new Error("Bạn không có quyền xem phân quyền")} />;
  if (!roles.data || !permissions.data)
    return roles.error || permissions.error ? (
      <ErrorState
        error={roles.error ?? permissions.error}
        onRetry={() => {
          void roles.refetch();
          void permissions.refetch();
        }}
      />
    ) : (
      <Skeleton />
    );
  const selected =
    roles.data.find((role) => role.id === id) ??
    roles.data.find((role) => !role.fullAccess) ??
    roles.data[0];
  return (
    <>
      <PageTitle
        title="Phân quyền"
        description="Chọn vai trò và cấp các quyền phù hợp với công việc."
      />
      {roles.error && <ErrorState error={roles.error} onRetry={() => void roles.refetch()} />}
      <Card>
        <Field label="Vai trò">
          <select
            value={selected?.id ?? ""}
            onChange={(event) => {
              if (dirty) setPending(event.target.value);
              else setId(event.target.value);
            }}
          >
            {roles.data.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </Field>
      </Card>
      {selected && (
        <PermissionEditor
          key={selected.id}
          role={selected}
          permissions={permissions.data}
          onDirtyChange={setDirty}
        />
      )}
      <ConfirmDialog
        open={pending !== null}
        title="Bỏ thay đổi chưa lưu?"
        description="Các quyền đang chọn chưa được lưu."
        onCancel={() => setPending(null)}
        onConfirm={() => {
          setId(pending!);
          setDirty(false);
          setPending(null);
        }}
      />
    </>
  );
}
