import { customers } from "@/platform/site";
import { customerImportHeaders } from "@/platform/customer-import-headers";
import type { FormField, FormValues } from "../shared/forms/record-form";

export const customerKinds = [
  { value: "bookstore", label: "Nhà sách" },
  { value: "individual", label: "Cá nhân" },
  { value: "company", label: "Công ty" },
];

export type CustomerField = FormField & { extraKey?: string; importHeaders?: string[] };
export const customerFields: CustomerField[] = [
  {
    key: "name",
    label: "Tên khách",
    type: "text",
    required: true,
    importHeaders: customerImportHeaders.name,
  },
  {
    key: "kind",
    label: "Loại khách",
    type: "select",
    required: true,
    options: customerKinds,
    importHeaders: customerImportHeaders.kind,
  },
  {
    key: "address",
    label: "Địa chỉ",
    type: "textarea",
    full: true,
    importHeaders: customerImportHeaders.address,
  },
  { key: "phone", label: "Điện thoại", type: "text", importHeaders: customerImportHeaders.phone },
  { key: "email", label: "Email", type: "email", importHeaders: customerImportHeaders.email },
  {
    key: "representative",
    label: "Người đại diện",
    type: "text",
    importHeaders: customerImportHeaders.representative,
  },
  {
    key: "vatRate",
    label: "VAT (%)",
    type: "number",
    min: 0,
    max: 100,
    description: "Mức thuế VAT mặc định khi lập phiếu; không tự tính thuế.",
    importHeaders: customerImportHeaders.vatRate,
  },
  {
    key: "active",
    label: "Hoạt động",
    type: "checkbox",
    description: "Tắt để ngừng chọn khách này khi lập phiếu mới. Phiếu cũ vẫn được giữ.",
  },
  {
    key: "notes",
    label: "Thông tin thêm",
    type: "textarea",
    full: true,
    importHeaders: customerImportHeaders.notes,
  },
  ...customers.extraFields.map((field): CustomerField => ({
    key: `extra_${field.key}`,
    extraKey: field.key,
    label: field.label,
    type: field.type === "boolean" ? "checkbox" : field.type,
    importHeaders: [field.label, ...(field.importHeaders ?? [])],
  })),
];

export function customerFormValues(record: FormValues): FormValues {
  const extra = record.extra as Record<string, unknown> | null | undefined;
  return {
    ...record,
    representative: record.representative ?? "",
    ...Object.fromEntries(
      customers.extraFields.map((field) => [
        `extra_${field.key}`,
        extra?.[field.key] ?? (field.type === "boolean" ? false : ""),
      ]),
    ),
  };
}

export function customerFormInput(values: FormValues, initial: FormValues): FormValues {
  const body = { ...values };
  const extra = {
    ...(initial.extra as Record<string, string | number | boolean | null> | null | undefined),
  };
  for (const field of customers.extraFields) {
    const key = `extra_${field.key}`;
    const value = body[key];
    extra[field.key] = value == null || value === "" ? null : (value as string | number | boolean);
    delete body[key];
    if (
      (typeof extra[field.key] === "string" && String(extra[field.key]).length > 500) ||
      (typeof extra[field.key] === "number" && !Number.isFinite(extra[field.key]))
    )
      throw new Error(`Giá trị ${field.label} không hợp lệ.`);
  }
  if (String(body.representative ?? "").length > 255)
    throw new Error("Người đại diện tối đa 255 ký tự.");
  if (Object.keys(extra).length > 30) throw new Error("Tối đa 30 trường mở rộng.");
  return { ...body, extra };
}
