import { useState, useMemo } from "react";
import { EntityManager, type EntityConfig } from "../../shared/entity-manager";
import type { AuditEvent } from "../../services/contracts";
import { Button, Modal } from "../../shared/ui/primitives";
import { date } from "../../shared/lib/text";
export default function AuditLogs() {
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const config = useMemo<EntityConfig<"audit">>(
    () => ({
      entity: "audit",
      title: "Nhật ký hệ thống",
      description: "Lịch sử thay đổi trong bộ dữ liệu demo. Không thể sửa hoặc xóa audit log.",
      readOnly: true,
      dateField: "createdAt",
      defaultSort: { field: "createdAt", direction: "desc" },
      fields: [],
      defaults: { actor: "", resource: "", action: "", recordId: "", before: "", after: "" },
      columns: [
        {
          accessorKey: "createdAt",
          header: "Thời gian",
          cell: ({ getValue }) => date(String(getValue())),
        },
        { accessorKey: "actor", header: "Tài khoản" },
        { accessorKey: "resource", header: "Tài nguyên" },
        { accessorKey: "action", header: "Thao tác" },
        { accessorKey: "recordId", header: "Bản ghi", size: 250 },
        {
          id: "detail",
          header: "Chi tiết",
          enableSorting: false,
          cell: ({ row }) => (
            <Button size="sm" onClick={() => setSelected(row.original)}>
              Xem thay đổi
            </Button>
          ),
        },
      ],
    }),
    [],
  );
  return (
    <>
      <EntityManager config={config} />
      <Modal
        open={!!selected}
        onOpenChange={(v) => {
          if (!v) setSelected(null);
        }}
        title="Chi tiết thay đổi"
        wide
      >
        <div className="a-dialog-body">
          <p>
            {selected?.action} · {selected?.resource}
          </p>
          <div className="a-grid-2" style={{ marginTop: 16 }}>
            <div>
              <h3>Trước</h3>
              <pre className="a-code">{selected?.before}</pre>
            </div>
            <div>
              <h3>Sau</h3>
              <pre className="a-code">{selected?.after}</pre>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
