import type { EntityConfig } from "../shared/entity-manager";
import { Badge } from "../shared/ui/primitives";
import { date } from "../shared/lib/text";
import { roleNames, defaultPermissions } from "./permissions";
export const userConfig: EntityConfig<"users"> = {
  entity: "users",
  title: "Người dùng",
  description: "Tài khoản giả lập dùng để thử vai trò. Không phải quản lý tài khoản production.",
  defaults: { name: "", email: "", roleId: "viewer", active: true, lastLogin: null },
  fields: [
    { key: "name", label: "Họ tên", type: "text", required: true },
    { key: "email", label: "Email demo", type: "email", required: true },
    { key: "roleId", label: "Vai trò", type: "select", entity: "roles", required: true },
    { key: "active", label: "Tài khoản hoạt động", type: "checkbox" },
  ],
  filters: [
    {
      field: "roleId",
      label: "Vai trò",
      options: Object.entries(roleNames).map(([value, label]) => ({ value, label })),
    },
    {
      field: "active",
      label: "Trạng thái",
      options: [
        { value: "true", label: "Hoạt động" },
        { value: "false", label: "Vô hiệu hóa" },
      ],
    },
  ],
  columns: [
    {
      accessorKey: "name",
      header: "Người dùng",
      size: 250,
      cell: ({ row }) => (
        <span>
          <strong>{row.original.name}</strong>
          <small>{row.original.email}</small>
        </span>
      ),
    },
    {
      accessorKey: "roleId",
      header: "Vai trò",
      cell: ({ getValue }) => roleNames[String(getValue())] ?? String(getValue()),
    },
    {
      accessorKey: "active",
      header: "Trạng thái",
      cell: ({ getValue }) => (
        <Badge tone={getValue() ? "success" : "neutral"}>
          {getValue() ? "Hoạt động" : "Vô hiệu hóa"}
        </Badge>
      ),
    },
    {
      accessorKey: "lastLogin",
      header: "Lần đăng nhập",
      cell: ({ getValue }) => date(getValue() as string | null),
    },
  ],
};
export const roleConfig: EntityConfig<"roles"> = {
  entity: "roles",
  title: "Vai trò",
  description: "Quản lý nhóm quyền và ma trận ở trang Phân quyền.",
  defaults: { name: "", description: "", permissions: defaultPermissions("viewer") },
  fields: [
    { key: "name", label: "Tên vai trò", type: "text", required: true },
    { key: "description", label: "Mô tả", type: "textarea", full: true },
  ],
};
