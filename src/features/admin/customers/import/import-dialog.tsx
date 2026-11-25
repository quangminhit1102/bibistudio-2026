import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { customers } from "@/platform/site";
import { AdminHttpError } from "@/lib/admin-http";
import { useAdmin, useRole } from "../../services/context";
import { can } from "../../accounts/permissions";
import { Badge, Button, Modal, useNotice } from "../../shared/ui/primitives";
import { downloadBlob } from "../../shared/lib/text";
import { customerKinds } from "../fields";
import { importCustomers, type ImportRow, type ImportResult } from "../api";
import {
  customerImportColumns,
  importCellErrors,
  inferKind,
  prepareImportRows,
  parseCustomerWorkbook,
} from "./parse";
import { customerSampleWorkbook } from "./sample";
import { customerImportErrorMessage } from "./errors";
import { reconcileImportRows } from "./preview";

export default function CustomerImportDialog({ onClose }: { onClose: () => void }) {
  const runtime = useAdmin();
  const role = useRole();
  const query = useQueryClient();
  const notice = useNotice();
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [unknown, setUnknown] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const serial = useRef(0);
  useEffect(
    () => () => {
      serial.current++;
    },
    [],
  );
  const mayUpdate = can(runtime.session, "bookstore", "update", role.data);
  const columns = customerImportColumns(customers);
  useEffect(() => {
    if (!rows.length) {
      setPreview(null);
      setChecking(false);
      return;
    }
    let current = true;
    setChecking(true);
    const timer = setTimeout(() => {
      importCustomers(runtime, { dryRun: true, rows: prepareImportRows(rows, customers) })
        .then((result) => {
          if (current) {
            const next = reconcileImportRows(rows, result);
            if (next !== rows) {
              setRows(next);
              setPreview(null);
            } else setPreview(result);
            setError("");
          }
        })
        .catch((e) => {
          if (current) {
            setPreview(null);
            setError(e instanceof Error ? e.message : "Không thể kiểm tra dữ liệu");
          }
        })
        .finally(() => {
          if (current) setChecking(false);
        });
    }, 200);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [rows, reload, runtime]);

  async function chooseFile(file: File) {
    const request = ++serial.current;
    setLoading(true);
    setRows([]);
    setPreview(null);
    setUnknown([]);
    setError("");
    setPage(1);
    try {
      const parsed = await parseCustomerWorkbook(file, customers);
      const result = await importCustomers(runtime, { dryRun: true, rows: parsed.rows });
      if (request !== serial.current) return;
      setRows(reconcileImportRows(parsed.rows, result));
      setUnknown(parsed.unknownColumns);
      setPreview(result);
      setChecking(parsed.rows.length > 0);
      if (!parsed.rows.length) setError("File không có dòng dữ liệu.");
    } catch (e) {
      if (request === serial.current)
        setError(e instanceof Error ? e.message : "Không thể đọc file");
    } finally {
      if (request === serial.current) setLoading(false);
    }
  }
  function patch(rowNumber: number, change: Partial<ImportRow>) {
    setChecking(true);
    setRows((items) => items.map((row) => (row.row === rowNumber ? { ...row, ...change } : row)));
  }
  function edit(row: ImportRow, key: string, value: string | boolean, extraKey?: string) {
    const input = extraKey
      ? { ...row.fields, extra: { ...row.fields.extra, [extraKey]: value } }
      : { ...row.fields, [key]: value };
    const kindInferred = key === "kind" ? !String(value ?? "").trim() : row.kindInferred;
    if (kindInferred && (key === "name" || key === "kind"))
      input.kind = inferKind(String(input.name ?? ""));
    patch(row.row, {
      fields: input,
      kindInferred,
      emptyFields:
        extraKey || !["kind", "vatRate"].includes(key)
          ? row.emptyFields
          : [
              ...(row.emptyFields ?? []).filter((field) => field !== key),
              ...(String(value ?? "").trim() ? [] : [key]),
            ],
    });
  }
  const localErrors = rows.flatMap((r) => importCellErrors(r, customers));
  const blocked =
    loading ||
    checking ||
    saving ||
    !rows.length ||
    !preview ||
    Boolean(error) ||
    localErrors.length > 0 ||
    preview.rows.some((r) => r.errors.length > 0);
  const problems = (row: ImportRow) =>
    localErrors.some((e) => e.row === row.row) ||
    preview?.rows.some((r) => r.row === row.row && r.status !== "ok");
  const filtered = onlyProblems ? rows.filter(problems) : rows;
  const visible = filtered.slice((page - 1) * 25, page * 25);
  async function confirm() {
    if (blocked) return;
    setSaving(true);
    setError("");
    try {
      const result = await importCustomers(runtime, {
        dryRun: false,
        rows: prepareImportRows(rows, customers),
      });
      await query.invalidateQueries({ queryKey: ["bibi-admin", "customers"] });
      notice(`Đã thêm ${result.created}, cập nhật ${result.updated}, bỏ qua ${result.skipped}`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import thất bại");
      if (e instanceof AdminHttpError && (e.status === 400 || e.status === 409)) {
        if (e.status === 409)
          setRows((items) =>
            items.map((row) =>
              row.action === "update"
                ? { ...row, action: "skip", targetId: undefined, revision: undefined }
                : row,
            ),
          );
        setChecking(true);
        setReload((value) => value + 1);
      }
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
      title="Import khách hàng từ Excel"
      description="Chọn file, kiểm tra và sửa dữ liệu trước khi xác nhận. Dòng trùng mặc định được bỏ qua."
      wide
    >
      <div className="a-toolbar">
        <Button
          disabled={loading || saving}
          onClick={async () => {
            try {
              downloadBlob(await customerSampleWorkbook(customers), "khach-hang-mau.xlsx");
            } catch (e) {
              setError(e instanceof Error ? e.message : "Không tải được file mẫu");
            }
          }}
        >
          Tải file mẫu
        </Button>
        <label>
          Chọn file .xlsx
          <input
            aria-label="Chọn file .xlsx"
            type="file"
            accept=".xlsx"
            disabled={loading || saving}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void chooseFile(file);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {error && <p role="alert">{error}</p>}
      {unknown.length > 0 && <p>Cột bỏ qua: {unknown.join(", ")}</p>}
      {(loading || checking) && <p role="status">Đang kiểm tra dữ liệu…</p>}
      {rows.length > 0 && (
        <>
          <p>
            {rows.length} dòng · {preview?.rows.filter((r) => r.status === "ok").length ?? 0} hợp lệ
            · {preview?.rows.filter((r) => r.status === "duplicate").length ?? 0} trùng ·{" "}
            {
              new Set([
                ...localErrors.map((r) => r.row),
                ...(preview?.rows.filter((r) => r.errors.length).map((r) => r.row) ?? []),
              ]).size
            }{" "}
            lỗi
          </p>
          <label>
            <input
              type="checkbox"
              checked={onlyProblems}
              onChange={(e) => {
                setOnlyProblems(e.target.checked);
                setPage(1);
              }}
            />{" "}
            Chỉ hiện dòng có vấn đề
          </label>
          <div className="a-table-wrap">
            <table className="a-table a-customer-import-table">
              <thead>
                <tr>
                  <th>Dòng</th>
                  {columns.map((f) => (
                    <th key={f.key}>{f.key === "kind" ? "Loại" : f.label}</th>
                  ))}
                  <th>Tình trạng</th>
                  <th>Xử lý</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const check = preview?.rows.find((r) => r.row === row.row);
                  const errors = [
                    ...new Map(
                      [
                        ...localErrors.filter((r) => r.row === row.row),
                        ...(check?.errors ?? []),
                      ].map((error) => {
                        const message = customerImportErrorMessage(
                          error.field,
                          row.fields,
                          customers,
                        );
                        return [`${error.field}:${message}`, { ...error, message }];
                      }),
                    ).values(),
                  ];
                  const duplicate = Boolean(check?.matches.length || check?.inFile);
                  return (
                    <tr key={row.row}>
                      <td>{row.row}</td>
                      {columns.map((field) => {
                        const value = field.extraKey
                          ? row.fields.extra?.[field.extraKey]
                          : row.fields[field.key as keyof ImportRow["fields"]];
                        const label = `${field.key === "name" ? "Tên" : field.key === "kind" ? "Loại" : field.key === "vatRate" ? "VAT" : field.label} dòng ${row.row}`;
                        return (
                          <td key={field.key} data-field={field.key}>
                            {field.key === "kind" ? (
                              <select
                                aria-label={label}
                                title={String(value ?? "")}
                                value={String(value ?? "")}
                                disabled={saving}
                                onChange={(e) => edit(row, field.key, e.target.value)}
                              >
                                {!customerKinds.some((k) => k.value === value) && (
                                  <option value={String(value ?? "")}>
                                    {String(value ?? "") || "Chọn loại"}
                                  </option>
                                )}
                                {customerKinds.map((k) => (
                                  <option key={k.value} value={k.value}>
                                    {k.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                aria-label={label}
                                title={String(value ?? "")}
                                type={field.type === "checkbox" ? "checkbox" : "text"}
                                checked={field.type === "checkbox" ? Boolean(value) : undefined}
                                value={field.type === "checkbox" ? undefined : String(value ?? "")}
                                disabled={saving}
                                onChange={(e) =>
                                  edit(
                                    row,
                                    field.key,
                                    field.type === "checkbox" ? e.target.checked : e.target.value,
                                    field.extraKey,
                                  )
                                }
                              />
                            )}
                          </td>
                        );
                      })}
                      <td>
                        <Badge tone={errors.length ? "error" : duplicate ? "warning" : "success"}>
                          {errors.length ? "Lỗi" : duplicate ? "Trùng" : "Hợp lệ"}
                        </Badge>
                        {check?.inFile && <small>Trùng dòng {check.inFile}</small>}
                        {check?.matches.map((m) => (
                          <small key={m.id}>
                            Trùng {m.name} ({m.by.join(", ")})
                          </small>
                        ))}
                        {errors.map((e, i) => (
                          <small key={i}>{e.message}</small>
                        ))}
                      </td>
                      <td>
                        <select
                          aria-label={`Xử lý dòng ${row.row}`}
                          disabled={saving}
                          value={row.action === "update" ? `update:${row.targetId}` : row.action}
                          onChange={(e) => {
                            const value = e.target.value;
                            const target = check?.matches.find((m) => `update:${m.id}` === value);
                            patch(row.row, {
                              actionChosen: true,
                              ...(target
                                ? {
                                    action: "update",
                                    targetId: target.id,
                                    revision: target.revision,
                                  }
                                : {
                                    action: value as "create" | "skip",
                                    targetId: undefined,
                                    revision: undefined,
                                  }),
                            });
                          }}
                        >
                          <option value="skip">Bỏ qua</option>
                          <option value="create">Tạo mới</option>
                          {mayUpdate &&
                            check?.matches.map((m) => (
                              <option key={m.id} value={`update:${m.id}`}>
                                Cập nhật {m.name}
                              </option>
                            ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="a-toolbar">
            <Button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Trang trước
            </Button>
            <span>
              Trang {page}/{Math.max(1, Math.ceil(filtered.length / 25))}
            </span>
            <Button disabled={page * 25 >= filtered.length} onClick={() => setPage((p) => p + 1)}>
              Trang sau
            </Button>
          </div>
        </>
      )}
      <div className="a-form-actions">
        <Button disabled={saving} onClick={onClose}>
          Hủy
        </Button>
        <Button
          variant="primary"
          disabled={blocked}
          loading={saving}
          onClick={() => void confirm()}
        >
          Xác nhận import ({rows.filter((r) => r.action !== "skip").length})
        </Button>
      </div>
    </Modal>
  );
}
