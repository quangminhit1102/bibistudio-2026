import { expect, it } from "vitest";
import { customerImportErrorMessage } from "../../src/features/admin/customers/import/errors";
const config = {
  extraFields: [
    { key: "region", label: "Khu vực", type: "text" as const },
    { key: "points", label: "Điểm", type: "number" as const },
    { key: "priority", label: "Ưu tiên", type: "boolean" as const },
  ],
};
it.each([
  ["name", "Tên khách hàng không hợp lệ (tối đa 255 ký tự)"],
  ["address", "Địa chỉ không hợp lệ"],
  ["email", "Email không hợp lệ"],
  ["phone", "Điện thoại không hợp lệ (tối đa 50 ký tự)"],
  ["kind", "Loại khách không hợp lệ (chọn Nhà sách, Cá nhân hoặc Công ty)"],
  ["vatRate", "VAT không hợp lệ (dùng Có, Không hoặc số 0–100)"],
  ["representative", "Người đại diện không hợp lệ (tối đa 255 ký tự)"],
  ["notes", "Thông tin thêm không hợp lệ"],
  ["active", "Trạng thái hoạt động không hợp lệ"],
  ["extra.region", "Khu vực không hợp lệ (tối đa 500 ký tự)"],
  ["extra.points", "Điểm phải là số hợp lệ"],
  ["extra.priority", "Ưu tiên phải là Có hoặc Không"],
  ["extra", "Trường mở rộng không hợp lệ (tối đa 30 trường)"],
  ["extra.legacy", "Trường mở rộng (legacy) không hợp lệ"],
  ["targetId", "Khách hàng cập nhật không tồn tại hoặc chưa được chọn"],
  ["revision", "Phiên bản khách hàng không hợp lệ hoặc đã thay đổi, vui lòng tải lại"],
  ["action", "Lựa chọn xử lý không hợp lệ"],
  ["row", "Số dòng không hợp lệ"],
  ["unknown", "Thông tin khách hàng không hợp lệ"],
])("localizes %s with its field name", (field, expected) => {
  expect(customerImportErrorMessage(field, { name: "Existing name" }, config)).toBe(expected);
});
it("explains a required missing or blank name", () => {
  for (const name of [undefined, "", "   "])
    expect(customerImportErrorMessage("name", { name }, config)).toBe("Tên khách hàng là bắt buộc");
});
