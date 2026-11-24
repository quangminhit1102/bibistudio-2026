import { FileText, Folder, Image, Plus } from "lucide-react";
import type { AdminModule } from "../modules";

export const contentModule: AdminModule = {
  id: "content",
  resource: "content",
  paths: ["/admin/content"],
  items: [
    {
      group: "content",
      label: "Bài viết",
      path: "/admin/content/posts",
      resource: "content",
      icon: FileText,
    },
    {
      group: "content",
      label: "Viết bài mới",
      path: "/admin/content/posts/create",
      resource: "content",
      action: "create",
      icon: Plus,
    },
    {
      group: "content",
      label: "Chuyên mục",
      path: "/admin/content/categories",
      resource: "content",
      icon: Folder,
    },
    {
      group: "content",
      label: "Thư viện ảnh",
      path: "/admin/content/media",
      resource: "content",
      icon: Image,
    },
  ],
};
