import { LayoutDashboard } from "lucide-react";
import type { AdminModule } from "../modules";

export const dashboardModule: AdminModule = {
  id: "core",
  paths: ["/admin/dashboard"],
  items: [
    {
      group: "overview",
      label: "Bảng điều khiển",
      path: "/admin/dashboard",
      resource: "dashboard",
      icon: LayoutDashboard,
    },
  ],
};
