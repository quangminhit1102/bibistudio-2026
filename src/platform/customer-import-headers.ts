export const customerImportHeaders = {
  name: ["Tên khách hàng", "Tên", "Tên khách"],
  kind: ["Loại", "Loại khách"],
  address: ["Địa chỉ"],
  phone: ["Điện thoại"],
  email: ["Email"],
  representative: ["Người đại diện"],
  vatRate: ["VAT"],
  notes: ["Thông tin", "Ghi chú"],
};

export const normalizeCustomerImportHeader = (value: unknown) =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("vi");
