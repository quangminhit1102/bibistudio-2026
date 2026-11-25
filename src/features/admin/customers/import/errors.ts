import type { CustomerFieldConfig } from "@/platform/site-contract";
import type { ImportRow } from "../api";

export function customerImportErrorMessage(
  field: string,
  values: ImportRow["fields"],
  config: CustomerFieldConfig,
): string {
  if (field === "name")
    return String(values.name ?? "").trim()
      ? "Tên khách hàng không hợp lệ (tối đa 255 ký tự)"
      : "Tên khách hàng là bắt buộc";
  if (field.startsWith("extra.")) {
    const key = field.slice("extra.".length);
    const extra = config.extraFields.find((entry) => entry.key === key);
    if (!extra) return `Trường mở rộng (${key}) không hợp lệ`;
    if (extra.type === "number") return `${extra.label} phải là số hợp lệ`;
    if (extra.type === "boolean") return `${extra.label} phải là Có hoặc Không`;
    return `${extra.label} không hợp lệ (tối đa 500 ký tự)`;
  }
  const messages: Record<string, string> = {
    address: "Địa chỉ không hợp lệ",
    email: "Email không hợp lệ",
    phone: "Điện thoại không hợp lệ (tối đa 50 ký tự)",
    kind: "Loại khách không hợp lệ (chọn Nhà sách, Cá nhân hoặc Công ty)",
    vatRate: "VAT không hợp lệ (dùng Có, Không hoặc số 0–100)",
    representative: "Người đại diện không hợp lệ (tối đa 255 ký tự)",
    notes: "Thông tin thêm không hợp lệ",
    active: "Trạng thái hoạt động không hợp lệ",
    extra: "Trường mở rộng không hợp lệ (tối đa 30 trường)",
    targetId: "Khách hàng cập nhật không tồn tại hoặc chưa được chọn",
    revision: "Phiên bản khách hàng không hợp lệ hoặc đã thay đổi, vui lòng tải lại",
    action: "Lựa chọn xử lý không hợp lệ",
    row: "Số dòng không hợp lệ",
  };
  return Object.hasOwn(messages, field) ? messages[field] : "Thông tin khách hàng không hợp lệ";
}
