import {
  Boxes,
  ChartNoAxesCombined,
  MessageSquare,
  MousePointer2,
  Navigation,
  PanelsTopLeft,
  Table2,
  TextCursorInput,
} from "lucide-react";
import type { AdminModule } from "../modules";

export const componentsModule: AdminModule = {
  id: "components",
  resource: "components",
  paths: ["/admin/components"],
  browserOnly: true,
  items: [
    {
      group: "management",
      label: "Tổng quan thành phần UI",
      path: "/admin/components/overview",
      resource: "components",
      icon: Boxes,
    },
    {
      group: "management",
      label: "Hành động",
      path: "/admin/components/actions",
      resource: "components",
      icon: MousePointer2,
    },
    {
      group: "management",
      label: "Biểu mẫu",
      path: "/admin/components/forms",
      resource: "components",
      icon: TextCursorInput,
    },
    {
      group: "management",
      label: "Dữ liệu",
      path: "/admin/components/data-display",
      resource: "components",
      icon: Table2,
    },
    {
      group: "management",
      label: "Điều hướng",
      path: "/admin/components/navigation",
      resource: "components",
      icon: Navigation,
    },
    {
      group: "management",
      label: "Hộp thoại",
      path: "/admin/components/overlays",
      resource: "components",
      icon: PanelsTopLeft,
    },
    {
      group: "management",
      label: "Phản hồi",
      path: "/admin/components/feedback",
      resource: "components",
      icon: MessageSquare,
    },
    {
      group: "management",
      label: "Biểu đồ",
      path: "/admin/components/charts",
      resource: "components",
      icon: ChartNoAxesCombined,
    },
  ],
};
