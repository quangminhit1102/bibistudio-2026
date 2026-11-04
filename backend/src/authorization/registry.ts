/** Register implemented capabilities; new resources need rows, never new RBAC tables. */
const resources: Record<string, { label: string; actions: string[] }> = {
  customer_access: { label: "khách truy cập", actions: ["view"] },
  account: {
    label: "tài khoản",
    actions: [
      "view",
      "create",
      "update",
      "delete",
      "activate",
      "deactivate",
      "assign_role",
      "revoke_session",
    ],
  },
  role: { label: "vai trò", actions: ["view", "create", "update", "delete", "assign_permission"] },
  permission: { label: "danh sách quyền", actions: ["view"] },
  audit: { label: "nhật ký hệ thống", actions: ["view"] },
  dashboard: { label: "bảng điều khiển", actions: ["view"] },
  product: { label: "sản phẩm", actions: ["view", "create", "update", "delete", "export"] },
  customer: { label: "khách mua hàng", actions: ["view", "create", "update", "delete", "export"] },
  sales_slip: { label: "kinh doanh", actions: ["view", "create", "update", "delete", "export"] },
  post: { label: "nội dung", actions: ["view", "create", "update", "delete", "export"] },
  notification: { label: "thông báo", actions: ["view", "update"] },
  settings: { label: "cài đặt", actions: ["view", "update", "settings"] },
  components: { label: "thành phần giao diện", actions: ["view"] },
};
const actions: Record<string, string> = {
  view: "Xem",
  create: "Tạo",
  update: "Chỉnh sửa",
  delete: "Xóa",
  export: "Xuất dữ liệu",
  activate: "Kích hoạt",
  deactivate: "Ngừng hoạt động",
  assign_role: "Cấp vai trò cho",
  assign_permission: "Cấp quyền cho",
  revoke_session: "Thu hồi phiên của",
  settings: "Quản lý",
};
export const permissionDefinitions = Object.entries(resources).flatMap(([resource, config]) =>
  config.actions.map((action) => ({
    code: `${resource}.${action}`,
    description: `${actions[action]} ${config.label}`,
  })),
);
