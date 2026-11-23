import { Boxes, Layers, Package, Plus, Tags } from "lucide-react";
import type { AdminModule } from "../modules";

export const productsModule: AdminModule = {
  id: "products",
  resource: "products",
  paths: ["/admin/products"],
  items: [
    {
      group: "products",
      label: "Danh sách sản phẩm",
      path: "/admin/products/list",
      resource: "products",
      icon: Package,
    },
    {
      group: "products",
      label: "Thêm sản phẩm",
      path: "/admin/products/create",
      resource: "products",
      action: "create",
      icon: Plus,
    },
    {
      group: "products",
      label: "Loại sản phẩm",
      path: "/admin/products/types",
      resource: "products",
      icon: Tags,
    },
    {
      group: "products",
      label: "Danh mục",
      path: "/admin/products/categories",
      resource: "products",
      icon: Layers,
    },
  ],
};

export const inventoryModule: AdminModule = {
  id: "inventory",
  paths: ["/admin/products/inventory"],
  browserOnly: true,
  items: [
    {
      group: "products",
      label: "Tồn kho",
      path: "/admin/products/inventory",
      resource: "products",
      icon: Boxes,
    },
  ],
};
