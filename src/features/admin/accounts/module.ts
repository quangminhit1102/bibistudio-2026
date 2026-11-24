import { Layers, ShieldCheck, Users } from "lucide-react";
import type { AdminModule } from "../modules";

export const accountsModule: AdminModule = {
  id: "accounts",
  resource: "accounts",
  paths: ["/admin/accounts"],
  items: [
    {
      group: "management",
      label: "Người dùng",
      path: "/admin/accounts/users",
      resource: "accounts",
      icon: Users,
    },
    {
      group: "management",
      label: "Vai trò",
      path: "/admin/accounts/roles",
      resource: "accounts",
      icon: ShieldCheck,
      permissionCodes: ["role.view"],
    },
    {
      group: "management",
      label: "Phân quyền",
      path: "/admin/accounts/permissions",
      permissionCodes: ["role.view", "permission.view"],
      resource: "accounts",
      icon: Layers,
    },
  ],
};
