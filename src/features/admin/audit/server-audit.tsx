import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import type { AuditDto, Page } from "../../../../backend/src/http/contracts";
import { useAdmin } from "../services/context";
import { canCode } from "../accounts/permissions";
import { DataTable, type TableState } from "../shared/tables/data-table";
import { Button, ErrorState, Modal, PageTitle, Skeleton } from "../shared/ui/primitives";
import { date } from "../shared/lib/text";
const actionLabels: Record<string, string> = {
  "auth.login": "Đăng nhập",
  "auth.login_failure": "Đăng nhập không thành công",
  "auth.logout": "Đăng xuất",
  "auth.revoke": "Thu hồi phiên",
  "auth.token_reuse": "Phát hiện token đã được sử dụng",
  "identity.bootstrap": "Khởi tạo tài khoản",
  "account.create": "Tạo tài khoản",
  "account.update": "Cập nhật tài khoản",
  "account.activate": "Kích hoạt tài khoản",
  "account.deactivate": "Ngừng hoạt động tài khoản",
  "account.delete": "Xóa tài khoản",
  "account.assign_role": "Thay đổi vai trò",
  "role.create": "Tạo vai trò",
  "role.update": "Cập nhật vai trò",
  "role.delete": "Xóa vai trò",
  "role.assign_permission": "Thay đổi phân quyền",
};
export function ServerAudit() {
  const runtime = useAdmin();
  const [state, setState] = useState<TableState>({
    page: 1,
    pageSize: 20,
    search: "",
    filters: {},
  });
  const [selected, setSelected] = useState<AuditDto | null>(null);
  const events = useQuery({
    queryKey: [
      "bibi-admin",
      "http-audit",
      runtime.session?.userId,
      state.page,
      state.pageSize,
      state.search,
    ],
    enabled: canCode(runtime.session, "audit.view"),
    queryFn: ({ signal }) =>
      runtime.http!.request<Page<AuditDto>>(
        `/api/audit?${new URLSearchParams({ page: String(state.page), pageSize: String(state.pageSize), search: state.search })}`,
        { signal },
      ),
  });
  const columns = useMemo<ColumnDef<AuditDto, unknown>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: "Thời gian",
        enableSorting: false,
        cell: ({ row }) => date(row.original.createdAt),
      },
      {
        accessorKey: "actorId",
        header: "Tài khoản",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="a-audit-id" title={row.original.actorId ?? "Hệ thống"}>
            {row.original.actorId ?? "Hệ thống"}
          </span>
        ),
      },
      {
        accessorKey: "action",
        header: "Hành động",
        enableSorting: false,
        cell: ({ row }) => (
          <span title={row.original.action}>
            {actionLabels[row.original.action] ?? row.original.action}
          </span>
        ),
      },
      {
        accessorKey: "targetId",
        header: "Đối tượng",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="a-audit-id" title={row.original.targetId ?? ""}>
            {row.original.targetId ?? "—"}
          </span>
        ),
      },
      {
        id: "detail",
        header: "Chi tiết",
        enableSorting: false,
        cell: ({ row }) => (
          <Button size="sm" onClick={() => setSelected(row.original)}>
            Xem chi tiết
          </Button>
        ),
      },
    ],
    [],
  );
  if (runtime.sessionLoading) return <Skeleton />;
  if (!canCode(runtime.session, "audit.view"))
    return <ErrorState error={new Error("Bạn không có quyền xem nhật ký hệ thống")} />;
  return (
    <>
      <PageTitle
        title="Nhật ký hệ thống"
        description="Hoạt động đăng nhập, quản lý tài khoản và thay đổi phân quyền. Nhật ký chỉ có thể xem."
      />
      <DataTable
        columns={columns}
        result={events.data ?? { items: [], total: 0, page: state.page, pageSize: state.pageSize }}
        state={state}
        onStateChange={setState}
        loading={events.isPending}
        error={events.error}
        onRetry={() => void events.refetch()}
        selectable={false}
      />
      <Modal
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title="Chi tiết nhật ký"
      >
        <div className="a-dialog-body">
          <p>{selected ? (actionLabels[selected.action] ?? selected.action) : ""}</p>
          <pre className="a-audit-metadata">
            {JSON.stringify(selected?.metadata ?? {}, null, 2)}
          </pre>
        </div>
      </Modal>
    </>
  );
}
