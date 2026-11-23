import { ChartNoAxesCombined, ShoppingBag } from "lucide-react";
import type { AdminModule } from "../modules";

export const salesModule: AdminModule = {
  id: "sales",
  resource: "sales",
  paths: ["/admin/sales"],
  browserOnly: true,
  items: [
    {
      group: "business",
      label: "Phiếu mua hàng",
      path: "/admin/sales/slips",
      resource: "sales",
      icon: ShoppingBag,
    },
    {
      group: "business",
      label: "Báo cáo",
      path: "/admin/sales/reports",
      resource: "sales",
      icon: ChartNoAxesCombined,
    },
  ],
};
