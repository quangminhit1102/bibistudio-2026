import { Link } from "@tanstack/react-router";
import type { EntityConfig } from "../shared/entity-manager";
import { Badge } from "../shared/ui/primitives";
import { date } from "../shared/lib/text";
export const postConfig: EntityConfig<"posts"> = {
  entity: "posts",
  duplicate: true,
  title: "Bài viết",
  description: "Nhật ký, ý tưởng và những câu chuyện từ BiBi — dữ liệu.",
  createHref: "/admin/content/posts/create",
  editHref: (id) => `/admin/content/posts/${id}/edit`,
  detailHref: (id) => `/admin/content/posts/${id}`,
  defaults: {
    title: "",
    slug: "",
    excerpt: "",
    content: JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
    categoryId: "cat-journal",
    tagIds: [],
    authorId: "user-1",
    status: "draft",
    publishAt: null,
    imageId: null,
    seoTitle: "",
    seoDescription: "",
  },
  fields: [
    { key: "title", label: "Tiêu đề", type: "text", required: true, full: true },
    { key: "slug", label: "Đường dẫn", type: "text", required: true },
    { key: "authorId", label: "Tác giả", type: "select", entity: "users", required: true },
    {
      key: "categoryId",
      label: "Chuyên mục",
      type: "select",
      entity: "categories",
      filter: { kind: "content" },
    },
    { key: "tagIds", label: "Thẻ", type: "multi-select", entity: "tags" },
    {
      key: "status",
      label: "Trạng thái",
      type: "select",
      options: [
        { value: "draft", label: "Nháp" },
        { value: "published", label: "Đã xuất bản" },
      ],
    },
    { key: "publishAt", label: "Ngày xuất bản", type: "date" },
    { key: "excerpt", label: "Tóm tắt", type: "textarea", full: true },
    { key: "content", label: "Nội dung", type: "rich-text", full: true },
    { key: "imageId", label: "Ảnh đại diện", type: "media", full: true },
    { key: "seoTitle", label: "Tiêu đề SEO", type: "text" },
    { key: "seoDescription", label: "Mô tả SEO", type: "textarea" },
  ],
  filters: [
    {
      field: "status",
      label: "Trạng thái",
      options: [
        { value: "draft", label: "Nháp" },
        { value: "published", label: "Đã xuất bản" },
      ],
    },
  ],
  columns: [
    {
      accessorKey: "title",
      header: "Bài viết",
      size: 320,
      cell: ({ row }) => (
        <Link to={("/admin/content/posts/" + row.id) as "/admin"}>
          <strong>{row.original.title}</strong>
          <small>{row.original.slug}</small>
        </Link>
      ),
    },
    {
      accessorKey: "status",
      header: "Trạng thái",
      cell: ({ getValue }) => (
        <Badge tone={getValue() === "published" ? "success" : "neutral"}>
          {getValue() === "published" ? "Đã xuất bản" : "Nháp"}
        </Badge>
      ),
    },
    { accessorKey: "authorId", header: "Tác giả" },
    {
      accessorKey: "publishAt",
      header: "Ngày xuất bản",
      cell: ({ getValue }) => date(getValue() as string | null),
    },
  ],
};
export const tagConfig: EntityConfig<"tags"> = {
  entity: "tags",
  title: "Thẻ bài viết",
  description: "Sắp xếp nội dung bằng các thẻ dùng chung.",
  defaults: { name: "", description: "" },
  fields: [
    { key: "name", label: "Tên thẻ", type: "text", required: true },
    { key: "description", label: "Mô tả", type: "textarea" },
  ],
};
