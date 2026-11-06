import { useMemo, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import type { AccountDto } from "../../../../backend/src/http/contracts";
import { useAdmin } from "../services/context";
import { canCode } from "./permissions";
import { useAccountApi } from "./server-hooks";
import { AccountForm } from "./account-form";
import { DataTable, type TableState } from "../shared/tables/data-table";
import {
  ActionMenu,
  Badge,
  Button,
  ConfirmDialog,
  ErrorState,
  Modal,
  PageTitle,
  Skeleton,
  useNotice,
} from "../shared/ui/primitives";
import { UnsavedDialog } from "../shared/forms/preference-form";

export function ServerAccounts() {
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
  const [open, setOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<{ kind: "status" | "delete"; account: AccountDto } | null>(
    null,
  );
  const allowed = (code: string) => canCode(runtime.session, code);
  const accounts = useQuery({
    queryKey: [
      "bibi-admin",
      "http-accounts",
      runtime.session?.userId,
      state.page,
      state.pageSize,
      state.search,
    ],
    enabled: allowed("account.view"),
    queryFn: ({ signal }) => api.list(state, signal),
  });
  const roleOptions = useQuery({
    queryKey: ["bibi-admin", "http-role-options", runtime.session?.userId],
    enabled: open && allowed("account.assign_role"),
    queryFn: ({ signal }) => api.roleOptions(signal),
  });
  const columns = useMemo<ColumnDef<AccountDto, unknown>[]>(
    () => [
      {
        accessorKey: "username",
        header: "Tài khoản",
        enableSorting: false,
        cell: ({ row }) => (
          <Link to="/admin/accounts/users/$id" params={{ id: row.original.id }}>
            {row.original.username}
          </Link>
        ),
      },
      { accessorKey: "displayName", header: "Tên hiển thị", enableSorting: false },
      {
        accessorKey: "email",
        header: "Email",
        enableSorting: false,
        cell: ({ row }) => row.original.email ?? "—",
      },
      {
        id: "roles",
        header: "Vai trò",
        enableSorting: false,
        cell: ({ row }) =>
          row.original.roles.map((role) => role.name).join(", ") || "Chưa cấp vai trò",
      },
      {
        id: "status",
        header: "Trạng thái",
        enableSorting: false,
        cell: ({ row }) => (
          <Badge tone={row.original.active ? "success" : "neutral"}>
            {row.original.active ? "Hoạt động" : "Ngừng hoạt động"}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "Thao tác",
        enableSorting: false,
        cell: ({ row }) => {
          const account = row.original;
          if (account.isMaster)
            return (
              <Badge tone="privilege">
                <LockKeyhole size={12} aria-hidden />
                Quản trị chính
              </Badge>
            );
          const items = [
            ...(canCode(runtime.session, account.active ? "account.deactivate" : "account.activate")
              ? [
                  {
                    label: account.active ? "Ngừng hoạt động" : "Kích hoạt",
                    onSelect: () => setAction({ kind: "status", account }),
                  },
                ]
              : []),
            ...(canCode(runtime.session, "account.delete")
              ? [{ label: "Xóa tài khoản", onSelect: () => setAction({ kind: "delete", account }) }]
              : []),
          ];
          return items.length ? (
            <ActionMenu label={`Thao tác tài khoản ${account.username}`} items={items} />
          ) : null;
        },
      },
    ],
    [runtime.session],
  );
  if (runtime.sessionLoading) return <Skeleton />;
  if (!allowed("account.view"))
    return <ErrorState error={new Error("Bạn không có quyền xem tài khoản")} />;
  return (
    <>
      <PageTitle
        title="Tài khoản"
        description="Quản lý thông tin, trạng thái và vai trò của người dùng."
        actions={
          <>
            <Button onClick={() => void accounts.refetch()}>Tải lại</Button>
            {allowed("account.create") && (
              <Button variant="primary" onClick={() => setOpen(true)}>
                Tạo tài khoản
              </Button>
            )}
          </>
        }
      />
      <DataTable
        columns={columns}
        result={
          accounts.data ?? { items: [], total: 0, page: state.page, pageSize: state.pageSize }
        }
        state={state}
        onStateChange={setState}
        loading={accounts.isPending}
        error={accounts.error}
        onRetry={() => void accounts.refetch()}
        selectable={false}
      />
      <Modal
        open={open}
        title="Tạo tài khoản"
        description="Cấp các vai trò phù hợp với công việc."
        onOpenChange={(next) => {
          if (busy) return;
          if (!next && dirty) setDiscard(true);
          else setOpen(next);
        }}
      >
        <div className="a-dialog-body">
          {allowed("account.assign_role") && roleOptions.isPending ? (
            <Skeleton />
          ) : roleOptions.error ? (
            <ErrorState error={roleOptions.error} onRetry={() => void roleOptions.refetch()} />
          ) : (
            <AccountForm
              roles={roleOptions.data ?? []}
              onDirtyChange={setDirty}
              onCancel={() => (dirty ? setDiscard(true) : setOpen(false))}
              onSave={async (draft) => {
                setBusy(true);
                try {
                  const saved = await api.create(draft);
                  await cache.invalidateQueries({ queryKey: ["bibi-admin", "http-accounts"] });
                  setDirty(false);
                  setOpen(false);
                  notice("Đã tạo tài khoản");
                  return saved;
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
        description="Thông tin đang nhập sẽ không được lưu."
        onCancel={() => setDiscard(false)}
        onConfirm={() => {
          setDirty(false);
          setDiscard(false);
          setOpen(false);
        }}
      />
      <ConfirmDialog
        open={!!action}
        title={
          action?.kind === "delete"
            ? "Xóa tài khoản?"
            : action?.account.active
              ? "Ngừng hoạt động tài khoản?"
              : "Kích hoạt tài khoản?"
        }
        description={
          action?.account.active
            ? "Các phiên hiện tại sẽ được thu hồi nếu tài khoản bị xóa hoặc ngừng hoạt động."
            : "Xác nhận thay đổi trạng thái tài khoản này."
        }
        onCancel={() => setAction(null)}
        onConfirm={async () => {
          if (!action) return;
          try {
            if (action.kind === "delete") await api.remove(action.account);
            else await api.setActive(action.account, !action.account.active);
            setAction(null);
            await cache.invalidateQueries({ queryKey: ["bibi-admin", "http-accounts"] });
            notice("Đã cập nhật tài khoản");
          } catch (error) {
            void accounts.refetch();
            throw error;
          }
        }}
      />
    </>
  );
}
