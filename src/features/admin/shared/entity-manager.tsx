import { useMemo, useState, useCallback } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import { useAdmin, useEntity, useRole } from "../services/context";
import { can, resourceForEntity } from "../accounts/permissions";
import type { AdminModels, CreateInput, EntityKey, Resource } from "../services/contracts";
import { RecordForm, type FormField, type FormValues } from "./forms/record-form";
import { DataTable, type TableState } from "./tables/data-table";
import {
  ActionMenu,
  Badge,
  Button,
  ConfirmDialog,
  Modal,
  PageTitle,
  useNotice,
} from "./ui/primitives";
import { downloadBlob, makeCsv, date } from "./lib/text";
export interface EntityConfig<K extends EntityKey> {
  entity: K;
  title: string;
  description: string;
  fields: FormField[];
  defaults: CreateInput<K>;
  columns?: ColumnDef<AdminModels[K], unknown>[];
  filters?: { field: string; label: string; options: { value: string; label: string }[] }[];
  fixedFilters?: Record<string, string>;
  resource?: Resource;
  createHref?: string;
  editHref?: (id: string) => string;
  detailHref?: (id: string) => string;
  allowCreate?: boolean;
  readOnly?: boolean;
  duplicate?: boolean;
}
function readState(): TableState {
  const p = new URLSearchParams(location.search);
  return {
    page: Math.max(1, Number(p.get("page")) || 1),
    pageSize: [10, 20, 50, 100].includes(Number(p.get("size"))) ? Number(p.get("size")) : 10,
    search: p.get("q") ?? "",
    filters: {},
    sort: undefined,
  };
}
export function EntityManager<K extends EntityKey>({ config }: { config: EntityConfig<K> }) {
  const runtime = useAdmin();
  const role = useRole();
  const client = useQueryClient();
  const notice = useNotice();
  const navigate = useNavigate();
  const resource = config.resource ?? resourceForEntity(config.entity);
  const permitted = (action: "create" | "update" | "delete" | "export") =>
    !config.readOnly && can(runtime.session, resource, action, role.data);
  const [state, setState] = useState<TableState>(readState);
  const [selected, setSelected] = useState<RowSelectionState>({});
  const [editing, setEditing] = useState<AdminModels[K] | "new" | null>(null);
  const [remove, setRemove] = useState<AdminModels[K] | null>(null);
  const [dirty, setDirty] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [bulkDelete, setBulkDelete] = useState(false);
  const updateState = useCallback((s: TableState) => {
    setState(s);
    const p = new URLSearchParams(location.search);
    p.set("page", String(s.page));
    p.set("size", String(s.pageSize));
    if (s.search) p.set("q", s.search);
    else p.delete("q");
    history.replaceState(history.state, "", location.pathname + "?" + p);
  }, []);
  const result = useEntity(
    config.entity,
    { ...state, filters: { ...state.filters, ...config.fixedFilters } },
    resource,
  );
  const invalidate = () => client.invalidateQueries({ queryKey: ["bibi-admin"] });
  const service = runtime.service(config.entity, resource);
  const mutation = useMutation({
    mutationKey: ["bibi-admin", config.entity],
    mutationFn: async (values: FormValues) =>
      editing && editing !== "new"
        ? service.update(editing.id, values as Partial<CreateInput<K>>, editing.revision)
        : service.create(values as CreateInput<K>),
    onSuccess: () => {
      setDirty(false);
      setEditing(null);
      notice("Đã lưu dữ liệu demo.");
      void invalidate();
    },
  });
  const openEdit = (row: AdminModels[K]) =>
    config.editHref ? void navigate({ to: config.editHref(row.id) as "/admin" }) : setEditing(row);
  const columns = useMemo<ColumnDef<AdminModels[K], unknown>[]>(
    () => [
      ...(config.columns ?? [
        {
          accessorKey: "name",
          header: "Tên",
          cell: ({ row }) => (
            <strong>
              {String(
                (row.original as unknown as FormValues).name ??
                  (row.original as unknown as FormValues).title ??
                  row.id,
              )}
            </strong>
          ),
        },
        {
          accessorKey: "createdAt",
          header: "Ngày tạo",
          cell: ({ getValue }) => date(String(getValue())),
        },
      ]),
      {
        id: "actions",
        header: "",
        enableSorting: false,
        enableHiding: false,
        size: 55,
        cell: ({ row }) => (
          <ActionMenu
            label={`Thao tác ${row.id}`}
            items={[
              ...(config.detailHref
                ? [
                    {
                      label: "Xem chi tiết",
                      onSelect: () => void navigate({ to: config.detailHref!(row.id) as "/admin" }),
                    },
                  ]
                : []),
              {
                label: "Chỉnh sửa",
                disabled: !permitted("update"),
                onSelect: () => openEdit(row.original),
              },
              ...(config.duplicate
                ? [
                    {
                      label: "Nhân bản",
                      disabled: !permitted("create"),
                      onSelect: async () => {
                        try {
                          const raw = { ...row.original } as unknown as FormValues;
                          for (const k of ["id", "createdAt", "updatedAt", "revision"])
                            delete raw[k];
                          raw.name = String(raw.name) + " (bản sao)";
                          for (const k of ["sku", "slug", "isbn"])
                            if (raw[k]) raw[k] = String(raw[k]) + "-" + Date.now();
                          await service.create(raw as CreateInput<K>);
                          notice("Đã nhân bản.");
                          void invalidate();
                        } catch (e) {
                          notice(e instanceof Error ? e.message : "Không thể nhân bản", "error");
                        }
                      },
                    },
                  ]
                : []),
              {
                label: "Xóa",
                danger: true,
                disabled: !permitted("delete"),
                onSelect: () => setRemove(row.original),
              },
            ]}
          />
        ),
      },
    ],
    [config, role.data, runtime.session],
  );
  const exportRows = async () => {
    try {
      const rows = await service.list({
        ...state,
        page: 1,
        pageSize: 200,
        filters: { ...state.filters, ...config.fixedFilters },
      });
      const all = rows.items;
      const keys = Object.keys(all[0] ?? {});
      downloadBlob(
        new Blob(
          [
            makeCsv([
              keys,
              ...all.map((r) =>
                keys.map((k) => {
                  const v = (r as unknown as FormValues)[k];
                  return typeof v === "object" ? JSON.stringify(v) : v;
                }),
              ),
            ]),
          ],
          { type: "text/csv;charset=utf-8" },
        ),
        config.entity + ".csv",
      );
      notice(`Đã xuất ${all.length} dòng demo.`);
    } catch (e) {
      notice(e instanceof Error ? e.message : "Xuất thất bại", "error");
    }
  };
  return (
    <>
      <PageTitle
        title={config.title}
        description={config.description}
        actions={
          permitted("create") && config.allowCreate !== false ? (
            <Button
              variant="primary"
              onClick={() =>
                config.createHref
                  ? void navigate({ to: config.createHref as "/admin" })
                  : setEditing("new")
              }
            >
              <Plus size={15} />
              Thêm mới
            </Button>
          ) : undefined
        }
      />
      <div className="a-toolbar">
        {config.filters?.map((f) => (
          <select
            key={f.field}
            aria-label={f.label}
            value={state.filters[f.field] ?? ""}
            onChange={(e) =>
              updateState({
                ...state,
                page: 1,
                filters: { ...state.filters, [f.field]: e.target.value },
              })
            }
          >
            <option value="">{f.label}: Tất cả</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ))}
        {Object.values(selected).some(Boolean) && permitted("delete") && (
          <Button variant="destructive" onClick={() => setBulkDelete(true)}>
            <Trash2 size={14} />
            Xóa đã chọn
          </Button>
        )}
      </div>
      <DataTable
        columns={columns}
        result={result.data ?? { items: [], total: 0, page: state.page, pageSize: state.pageSize }}
        state={state}
        onStateChange={updateState}
        loading={result.isPending}
        error={result.error}
        onRetry={() => void result.refetch()}
        selection={selected}
        onSelectionChange={setSelected}
        onExport={
          can(runtime.session, resource, "export", role.data) ? () => void exportRows() : undefined
        }
      />
      <Modal
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) {
            if (dirty) setDiscard(true);
            else setEditing(null);
          }
        }}
        title={editing === "new" ? `Thêm ${config.title.toLowerCase()}` : "Chỉnh sửa"}
        wide
      >
        <div className="a-dialog-body">
          {editing && (
            <RecordForm
              key={editing === "new" ? "new" : editing.id}
              fields={config.fields}
              initial={(editing === "new" ? config.defaults : editing) as unknown as FormValues}
              onDirtyChange={setDirty}
              onSave={(values) => mutation.mutateAsync(values)}
              onCancel={() => (dirty ? setDiscard(true) : setEditing(null))}
            />
          )}
        </div>
      </Modal>
      <ConfirmDialog
        open={discard}
        title="Bỏ thay đổi chưa lưu?"
        description="Nội dung vừa chỉnh sửa sẽ không được lưu."
        onCancel={() => setDiscard(false)}
        onConfirm={() => {
          setDirty(false);
          setEditing(null);
        }}
      />
      <ConfirmDialog
        open={!!remove}
        title="Xóa bản ghi?"
        description="Dữ liệu có liên kết sẽ được bảo vệ và không thể xóa trực tiếp."
        onCancel={() => setRemove(null)}
        onConfirm={async () => {
          if (remove) {
            await service.remove(remove.id, remove.revision);
            notice("Đã xóa.");
            await invalidate();
          }
        }}
      />
      <ConfirmDialog
        open={bulkDelete}
        title="Xóa các bản ghi đã chọn?"
        description="Mỗi bản ghi được kiểm tra liên kết trước khi xóa. Các mục đang được dùng sẽ được giữ lại."
        onCancel={() => setBulkDelete(false)}
        onConfirm={async () => {
          let done = 0;
          const failures = [];
          for (const id of Object.keys(selected).filter((k) => selected[k])) {
            try {
              const r = await service.get(id);
              await service.remove(id, r.revision);
              done++;
            } catch (e) {
              failures.push(`${id}: ${e instanceof Error ? e.message : "lỗi"}`);
            }
          }
          setSelected({});
          await invalidate();
          if (failures.length)
            throw new Error(`Đã xóa ${done}; ${failures.length} mục được giữ lại. ${failures[0]}`);
          notice(`Đã xóa ${done} mục.`);
        }}
      />
    </>
  );
}
