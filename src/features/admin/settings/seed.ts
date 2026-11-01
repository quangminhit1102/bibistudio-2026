import { seedBase } from "../demo/clock";
import type { SeedBatch } from "../demo/registry";
export function seed(): SeedBatch {
  return {
    audit: [],
    notifications: Array.from({ length: 8 }, (_, i) => ({
      ...seedBase(`notification-${i + 1}`, i),
      name: [
        "Chào mừng đến BiBi Admin",
        "Kiểm tra sản phẩm đang nháp",
        "Báo cáo demo đã sẵn sàng",
        "Cập nhật thông tin hồ sơ",
      ][i % 4],
      description: "Thông báo mô phỏng, không kết nối dữ liệu production.",
      read: i > 2,
      level: i % 3 ? "info" : "warning",
      href: i % 2 ? "/admin/products/list" : "/admin/dashboard",
    })),
    settings: [
      {
        ...seedBase("general"),
        key: "general",
        values: {
          studioName: "BiBi Studio",
          email: "bibistudio@gmail.com",
          timezone: "Asia/Ho_Chi_Minh",
          language: "vi",
        },
      },
      { ...seedBase("security"), key: "security", values: { demoMfa: false, sessionTimeout: 30 } },
      {
        ...seedBase("profile"),
        key: "profile",
        values: { name: "Minh Nguyễn", email: "demo1@example.test" },
      },
    ],
  };
}
