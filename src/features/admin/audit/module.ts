import { ScrollText } from "lucide-react";
import type { AdminModule } from "../modules";

export const auditModule: AdminModule = {
  id: "audit",
  resource: "audit",
  paths: ["/admin/audit-logs"],
  items: [
    {
      group: "management",
      label: "Nhật ký hệ thống",
      path: "/admin/audit-logs",
      resource: "audit",
      icon: ScrollText,
    },
  ],
};
