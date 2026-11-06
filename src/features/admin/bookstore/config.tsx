import { Link } from "@tanstack/react-router";
import type { EntityConfig } from "../shared/entity-manager";
import { money } from "../shared/lib/text";
import { Badge } from "../shared/ui/primitives";
import { statuses } from "../products/config";
export const bookConfig: EntityConfig<"books"> = {
  entity: "books",
  title: "Sách",
  description: "Quản lý sách, tác giả, nhà xuất bản và tồn kho trong cùng một thư viện.",
  createHref: "/admin/bookstore/books/create",
  editHref: (id) => `/admin/bookstore/books/${id}/edit`,
  detailHref: (id) => `/admin/bookstore/books/${id}`,
  duplicate: true,
  defaults: {
    name: "",
    isbn: "",
    slug: "",
    authorIds: [],
    publisherId: "",
    genreIds: [],
    year: 2026,
    language: "vi",
    description: "",
    price: 0,
    stock: 0,
    reserved: 0,
    status: "draft",
    imageIds: [],
    tags: [],
    seoTitle: "",
    seoDescription: "",
  },
  fields: [
    { key: "name", label: "Tên sách", type: "text", required: true },
    { key: "isbn", label: "ISBN", type: "text", required: true },
    { key: "slug", label: "Đường dẫn", type: "text", required: true },
    { key: "authorIds", label: "Tác giả", type: "multi-select", entity: "authors", required: true },
    {
      key: "publisherId",
      label: "Nhà xuất bản",
      type: "select",
      entity: "publishers",
      required: true,
    },
    {
      key: "genreIds",
      label: "Thể loại",
      type: "multi-select",
      entity: "categories",
      filter: { kind: "genre" },
    },
    { key: "year", label: "Năm xuất bản", type: "number", min: 1000, max: 2100 },
    {
      key: "language",
      label: "Ngôn ngữ",
      type: "select",
      options: [
        { value: "vi", label: "Tiếng Việt" },
        { value: "en", label: "English" },
      ],
    },
    { key: "price", label: "Giá (VND)", type: "number", min: 0 },
    { key: "stock", label: "Tồn kho", type: "number", min: 0 },
    { key: "status", label: "Trạng thái", type: "select", options: statuses },
    { key: "description", label: "Mô tả", type: "textarea", full: true },
    { key: "imageIds", label: "Ảnh bìa", type: "media", full: true },
    { key: "tags", label: "Thẻ", type: "tags" },
    { key: "seoTitle", label: "SEO title", type: "text" },
    { key: "seoDescription", label: "SEO description", type: "textarea", full: true },
  ],
  filters: [
    { field: "status", label: "Trạng thái", options: statuses },
    {
      field: "language",
      label: "Ngôn ngữ",
      options: [
        { value: "vi", label: "Tiếng Việt" },
        { value: "en", label: "English" },
      ],
    },
  ],
  columns: [
    {
      accessorKey: "name",
      header: "Sách",
      size: 290,
      cell: ({ row }) => (
        <Link to={("/admin/bookstore/books/" + row.id) as "/admin"}>
          <strong>{row.original.name}</strong>
          <small>ISBN {row.original.isbn}</small>
        </Link>
      ),
    },
    { accessorKey: "year", header: "Năm" },
    { accessorKey: "price", header: "Giá", cell: ({ getValue }) => money(Number(getValue())) },
    { accessorKey: "stock", header: "Tồn kho" },
    {
      accessorKey: "status",
      header: "Trạng thái",
      cell: ({ getValue }) => (
        <Badge tone={getValue() === "published" ? "success" : "neutral"}>
          {statuses.find((o) => o.value === getValue())?.label}
        </Badge>
      ),
    },
  ],
};
export const authorConfig: EntityConfig<"authors"> = {
  entity: "authors",
  title: "Tác giả",
  description: "Hồ sơ tác giả. Tác giả có sách liên kết không thể bị xóa.",
  defaults: { name: "", description: "", nationality: "Việt Nam", birthDate: "" },
  fields: [
    { key: "name", label: "Họ tên", type: "text", required: true },
    { key: "nationality", label: "Quốc tịch", type: "text" },
    { key: "birthDate", label: "Ngày sinh", type: "date" },
    { key: "description", label: "Tiểu sử", type: "textarea", full: true },
  ],
};
export const publisherConfig: EntityConfig<"publishers"> = {
  entity: "publishers",
  title: "Nhà xuất bản",
  description: "Danh sách nhà xuất bản và thông tin liên hệ.",
  defaults: { name: "", description: "", country: "Việt Nam", email: "" },
  fields: [
    { key: "name", label: "Tên nhà xuất bản", type: "text", required: true },
    { key: "country", label: "Quốc gia", type: "text" },
    { key: "email", label: "Email liên hệ", type: "email" },
    { key: "description", label: "Thông tin", type: "textarea", full: true },
  ],
};
