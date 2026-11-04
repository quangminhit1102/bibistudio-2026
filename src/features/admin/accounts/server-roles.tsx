import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import type { RoleDto } from "../../../../backend/src/http/contracts";
import { useAdmin } from "../services/context";
import { useAccountApi } from "./server-hooks";
import { canCode } from "./permissions";
import {
  ActionMenu,
  Badge,
  Button,
  ConfirmDialog,
  ErrorState,
  Field,
  Modal,
  PageTitle,
  Skeleton,
  useNotice,
} from "../shared/ui/primitives";
import { DataTable, type TableState } from "../shared/tables/data-table";
import { UnsavedDialog } from "../shared/forms/preference-form";

function RoleForm({
  role,
  onSave,
  onDirty,
}: {
  role?: RoleDto;
  onSave: (input: { name: string; description: string }) => Promise<void>;
  onDirty: (value: boolean) => void;
}) {
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      onChange={() => onDirty(true)}
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        try {
          await onSave({ name, description });
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "Không thể lưu vai trò");
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label="Tên vai trò">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          maxLength={100}
          disabled={busy}
        />
      </Field>
      <Field label="Mô tả">
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={500}
          disabled={busy}
        />
      </Field>
      {error && (
        <p className="a-error" role="alert">
          {error}
        </p>
      )}
      <div className="a-form-footer">
        <Button variant="primary" type="submit" loading={busy}>
          Lưu vai trò
        </Button>
      </div>
    </form>
  );
}
export function ServerRoles() {
  const runtime = useAdmin();
  const api = useAccountApi();
  const cache = useQueryClient();
  const notice = useNotice();
  const [state, setState] = useState<TableState>({
    page: 1,
    pageSize: 20,
    search: "",
    filters: {},
  });
  const [editing, setEditing] = useState<RoleDto | "new" | null>(null);
  const [deleting, setDeleting] = useState<RoleDto | null>(null);
  const [dirty, setDirty] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [busy, setBusy] = useState(false);
  const roles = useQuery({
    queryKey: ["bibi-admin", "http-roles", runtime.session?.userId],
    enabled: canCode(runtime.session, "role.view"),
    queryFn: ({ signal }) => api.roles(signal),
  });
  const columns = useMemo<ColumnDef<RoleDto, unknown>[]>(
    () => [
      { accessorKey: "name", header: "Vai trò" },
      { accessorKey: "description", header: "Mô tả" },
      {
        id: "rights",
        header: "Quyền",
        cell: ({ row }) =>
          row.original.fullAccess ? (
            <Badge>Toàn quyền</Badge>
          ) : (
            `${row.original.permissionIds.length} quyền`
          ),
      },
      {
        id: "actions",
        header: "Thao tác",
        enableSorting: false,
        cell: ({ row }) => {
          const role = row.original;
          if (role.fullAccess) return <Badge>Được bảo vệ</Badge>;
          const items = [
            ...(canCode(runtime.session, "role.update")
              ? [
                  {
                    label: "Chỉnh sửa",
                    onSelect: () => {
                      setDirty(false);
                      setEditing(role);
                    },
                  },
                ]
              : []),
            ...(!role.isSystem && canCode(runtime.session, "role.delete")
              ? [{ label: "Xóa vai trò", onSelect: () => setDeleting(role) }]
              : []),
          ];
          return items.length ? (
            <ActionMenu label={`Thao tác vai trò ${role.name}`} items={items} />
          ) : null;
        },
      },
    ],
    [runtime.session],
  );
  if (runtime.sessionLoading) return <Skeleton />;
  if (!canCode(runtime.session, "role.view"))
    return <ErrorState error={new Error("Bạn không có quyền xem vai trò")} />;
  return (
    <>
      <PageTitle
        title="Vai trò"
        description="Tổ chức các nhóm quyền của tài khoản."
        actions={
          canCode(runtime.session, "role.create") && (
            <Button
              variant="primary"
              onClick={() => {
                setDirty(false);
                setEditing("new");
              }}
            >
              Tạo vai trò
            </Button>
          )
        }
      />
      <DataTable
        columns={columns}
        result={{
          items: roles.data ?? [],
          total: roles.data?.length ?? 0,
          page: state.page,
          pageSize: state.pageSize,
        }}
        clientRows={roles.data}
        state={state}
        onStateChange={setState}
        loading={roles.isPending}
        error={roles.error}
        onRetry={() => void roles.refetch()}
        selectable={false}
      />
      <Modal
        open={editing !== null}
        title={editing === "new" ? "Tạo vai trò" : "Chỉnh sửa vai trò"}
        onOpenChange={(open) => {
          if (busy) return;
          if (!open && dirty) setDiscard(true);
          else if (!open) setEditing(null);
        }}
      >
        <div className="a-dialog-body">
          {editing && (
            <RoleForm
              key={editing === "new" ? "new" : editing.id}
              role={editing === "new" ? undefined : editing}
              onDirty={setDirty}
              onSave={async (values) => {
                setBusy(true);
                try {
                  if (editing === "new") await api.createRole(values);
                  else await api.updateRole(editing, values);
                  setDirty(false);
                  setEditing(null);
                  await cache.invalidateQueries({ queryKey: ["bibi-admin", "http-roles"] });
                  notice("Đã lưu vai trò");
                } finally {
                  setBusy(false);
                }
              }}
            />
          )}
        </div>
      </Modal>
      <UnsavedDialog dirty={dirty} />
      <ConfirmDialog
        open={discard}
        title="Bỏ thay đổi chưa lưu?"
        description="Thông tin vai trò đang nhập sẽ không được lưu."
        onCancel={() => setDiscard(false)}
        onConfirm={() => {
          setDiscard(false);
          setDirty(false);
          setEditing(null);
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        title="Xóa vai trò?"
        description="Chỉ có thể xóa vai trò không được tài khoản nào sử dụng."
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting) await api.removeRole(deleting);
          setDeleting(null);
          await cache.invalidateQueries({ queryKey: ["bibi-admin", "http-roles"] });
          notice("Đã xóa vai trò");
        }}
      />
    </>
  );
}
