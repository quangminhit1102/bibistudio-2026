import type { CustomerFieldConfig } from "@/platform/site-contract";
import { normalizeCustomerImportHeader } from "@/platform/customer-import-headers";
import {
  inferKind,
  validateImportFields,
} from "../../../../../backend/src/content/customer-import";
import type { ImportRow } from "../api";
import { customerFields, type CustomerField } from "../fields";

export type CellError = { row: number; field: string; message: string };
const text = (value: unknown) => (value == null ? "" : String(value).trim());
const normalize = normalizeCustomerImportHeader;
const plain = (value: unknown) =>
  normalize(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export function customerImportColumns(config: CustomerFieldConfig): CustomerField[] {
  return [
    ...customerFields.filter((f) => !f.extraKey && f.importHeaders?.length),
    ...config.extraFields.map((f): CustomerField => ({
      key: `extra.${f.key}`,
      extraKey: f.key,
      label: f.label,
      type: f.type === "boolean" ? "checkbox" : f.type,
      importHeaders: [f.label, ...(f.importHeaders ?? [])],
    })),
  ];
}

export function normalizeImportCells(
  input: Record<string, unknown>,
  config: CustomerFieldConfig,
): ImportRow["fields"] {
  const fields = { ...input };
  for (const key of ["name", "address", "phone", "email", "representative", "notes"])
    if (fields[key] != null) fields[key] = text(fields[key]);
  const notes = text(fields.notes);
  if (!fields.email) {
    const email = notes.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
    if (email) fields.email = email;
  }
  if (!fields.phone) {
    const phone = notes.match(/(?:\+?84|0)[\d .()-]{8,18}\d/)?.[0];
    if (phone) fields.phone = phone.replace(/[ .()-]/g, "");
  }
  if (/^[35789]\d{8}$/.test(text(fields.phone))) fields.phone = "0" + text(fields.phone);
  const vat = plain(fields.vatRate);
  fields.vatRate =
    vat === "" || vat === "co"
      ? 8
      : vat === "khong"
        ? 0
        : /^\d+(?:[.,]\d+)?%?$/.test(vat)
          ? Number(vat.replace(/%$/, "").replace(",", "."))
          : fields.vatRate;
  const kind = plain(fields.kind);
  fields.kind = !kind
    ? inferKind(text(fields.name))
    : ((
        { "nha sach": "bookstore", "ca nhan": "individual", "cong ty": "company" } as Record<
          string,
          string
        >
      )[kind] ?? kind);
  const extra = { ...(fields.extra as Record<string, unknown> | undefined) };
  for (const field of config.extraFields) {
    if (!(field.key in extra) || extra[field.key] == null || text(extra[field.key]) === "")
      continue;
    const value = plain(extra[field.key]);
    if (field.type === "number" && Number.isFinite(Number(value))) extra[field.key] = Number(value);
    if (field.type === "boolean") {
      if (["co", "true", "1"].includes(value)) extra[field.key] = true;
      else if (["khong", "false", "0"].includes(value)) extra[field.key] = false;
    }
  }
  if (Object.keys(extra).length) fields.extra = extra;
  return fields as ImportRow["fields"];
}

export function importCellErrors(row: ImportRow, config: CustomerFieldConfig): CellError[] {
  if (row.action === "skip") return [];
  const fields = normalizeImportCells({ ...row.fields }, config);
  const parsed = validateImportFields(fields, row.action === "update");
  const errors: CellError[] = parsed.success
    ? []
    : parsed.error.issues.map((issue) => ({
        row: row.row,
        field: issue.path.join("."),
        message: issue.message,
      }));
  for (const field of config.extraFields) {
    const value = fields.extra?.[field.key];
    if (
      value != null &&
      value !== "" &&
      typeof value !== (field.type === "text" ? "string" : field.type)
    )
      errors.push({
        row: row.row,
        field: `extra.${field.key}`,
        message: `${field.label} không hợp lệ`,
      });
  }
  return errors;
}

export function prepareImportRows(rows: ImportRow[], config: CustomerFieldConfig): ImportRow[] {
  return rows.map((row) => ({ ...row, fields: normalizeImportCells({ ...row.fields }, config) }));
}

export async function parseCustomerWorkbook(
  file: File,
  fields: CustomerFieldConfig,
): Promise<{ rows: ImportRow[]; errors: CellError[]; unknownColumns: string[] }> {
  if (!/\.xlsx$/i.test(file.name)) throw new Error("Chỉ nhận file .xlsx");
  if (file.size > 2 * 1024 * 1024) throw new Error("File tối đa 2 MB");
  const { readSheet } = await import("read-excel-file/browser");
  let data: unknown[][];
  try {
    data = await readSheet(file, { trim: false, parseNumber: (value) => value });
  } catch {
    throw new Error("Không đọc được file .xlsx. Vui lòng kiểm tra file và thử lại.");
  }
  const columns = customerImportColumns(fields);
  const aliases = new Map(
    columns.flatMap((f) =>
      (f.importHeaders ?? []).map((header) => [normalize(header), f] as const),
    ),
  );
  const headerIndex =
    data
      .slice(0, 10)
      .map((row, index) => ({ index, fields: row.map((cell) => aliases.get(normalize(cell))) }))
      .filter((row) => row.fields.some((field) => field?.key === "name"))
      .sort((a, b) => b.fields.filter(Boolean).length - a.fields.filter(Boolean).length)[0]
      ?.index ?? -1;
  if (headerIndex < 0) throw new Error("Không tìm thấy dòng tiêu đề trong 10 dòng đầu");
  const headers = data[headerIndex];
  const mapped = headers.map((cell) => aliases.get(normalize(cell)));
  const keys = mapped.filter((f) => f).map((f) => f!.key);
  if (new Set(keys).size !== keys.length) throw new Error("Dòng tiêu đề có cột bị lặp");
  const unknownColumns = headers
    .filter((cell, i) => text(cell) && !mapped[i] && normalize(cell) !== "stt")
    .map(text);
  const rows: ImportRow[] = [];
  for (let index = headerIndex + 1; index < data.length; index++) {
    if (!data[index].some((cell) => text(cell))) continue;
    if (rows.length >= 1000) throw new Error("Tối đa 1.000 dòng mỗi lần import");
    const values: Record<string, unknown> = {};
    const extra: Record<string, unknown> = {};
    for (let col = 0; col < mapped.length; col++) {
      const field = mapped[col];
      if (!field) continue;
      const value = data[index][col];
      if (field.extraKey) extra[field.extraKey] = value == null ? null : value;
      else if (value != null) values[field.key] = value;
    }
    const row: ImportRow = {
      row: index + 1,
      action: "create",
      fields: normalizeImportCells(
        { ...values, ...(Object.keys(extra).length ? { extra } : {}) },
        fields,
      ),
      emptyFields: ["kind", "vatRate"].filter((key) => !text(values[key])),
    };
    rows.push(row);
  }
  return { rows, errors: rows.flatMap((row) => importCellErrors(row, fields)), unknownColumns };
}
