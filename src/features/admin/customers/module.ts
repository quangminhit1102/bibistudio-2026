import { BookOpen } from "lucide-react";
import type { AdminModule } from "../modules";

export const customersModule: AdminModule = {
  id: "customers",
  resource: "bookstore",
  paths: ["/admin/customers", "/admin/bookstore"],
  items: [
    {
      group: "business",
      label: "Khách mua hàng",
      path: "/admin/customers",
      resource: "bookstore",
      icon: BookOpen,
    },
  ],
};
