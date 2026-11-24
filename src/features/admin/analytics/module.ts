import { ChartNoAxesCombined } from "lucide-react";
import type { AdminModule } from "../modules";

export const analyticsModule: AdminModule = {
  id: "analytics",
  resource: "analytics",
  paths: ["/admin/analytics"],
  items: [
    {
      group: "overview",
      label: "Khách truy cập",
      path: "/admin/analytics/visitors",
      resource: "analytics",
      icon: ChartNoAxesCombined,
    },
  ],
};
