import { Link } from "@tanstack/react-router";
import type { EntityConfig } from "../shared/entity-manager";
import { Badge } from "../shared/ui/primitives";
import { MediaImage } from "../content/components/media-image";
import { money } from "../shared/lib/text";
export const statuses = [
  { value: "draft", label: "Nháp" },
  { value: "published", label: "Đang hiển thị" },
  { value: "hidden", label: "Đã ẩn" },
];
export const productTypes = [
  { value: "notebook", label: "Sổ tay" },
  { value: "greeting-card", label: "Thiệp" },
  { value: "postcard", label: "Postcard" },
  { value: "envelope", label: "Bao thư" },
  { value: "letter-paper", label: "Giấy viết thư" },
  { value: "magnet", label: "Magnet" },
];
export const collectionOptions = [
  { value: "explore-vietnam", label: "Khám phá Việt Nam" },
  { value: "vietnamese-food", label: "Món ăn Việt Nam" },
  { value: "motivation", label: "Tạo động lực" },
  { value: "ao-dai", label: "Áo dài" },
  { value: "greeting-cards", label: "Thiệp chúc mừng" },
  { value: "pressed-flower-cards", label: "Thiệp ép hoa khô" },
  { value: "spiral-cards", label: "Thiệp xoắn" },
];
export const productConfig: EntityConfig<"products"> = {
  entity: "products",
  title: "Sản phẩm",
  description: "Quản lý catalogue — mỗi sản phẩm bắt đầu từ một câu chuyện.",
  createHref: "/admin/products/create",
  editHref: (id) => `/admin/products/${id}/edit`,
  detailHref: (id) => `/admin/products/${id}`,
  duplicate: true,
  defaults: {
    name: "",
    sku: "",
    slug: "",
    description: "",
    shortDescription: "",
    productType: "notebook",
    collection: "explore-vietnam",
    categoryId: "cat-notebook",
    price: 0,
    compareAt: 0,
    stock: 0,
    reserved: 0,
    status: "draft",
    imageIds: [],
    tags: [],
    seoTitle: "",
    seoDescription: "",
  },
  fields: [
    { key: "name", label: "Tên sản phẩm", type: "text", required: true },
    { key: "sku", label: "SKU", type: "text", required: true },
    { key: "slug", label: "Đường dẫn", type: "text", required: true },
    { key: "status", label: "Trạng thái", type: "select", options: statuses },
    { key: "productType", label: "Loại sản phẩm", type: "select", options: productTypes },
    { key: "collection", label: "Bộ sưu tập", type: "select", options: collectionOptions },
    {
      key: "categoryId",
      label: "Danh mục",
      type: "select",
      entity: "categories",
      filter: { kind: "product" },
    },
    { key: "price", label: "Giá (VND)", type: "number", min: 0 },
    { key: "compareAt", label: "Giá so sánh (VND)", type: "number", min: 0 },
    { key: "stock", label: "Tồn kho", type: "number", min: 0 },
    { key: "shortDescription", label: "Mô tả ngắn", type: "textarea", full: true },
    { key: "description", label: "Mô tả", type: "textarea", full: true },
    { key: "imageIds", label: "Ảnh sản phẩm", type: "media", full: true },
    { key: "tags", label: "Thẻ", type: "tags", full: true },
    { key: "seoTitle", label: "Tiêu đề SEO", type: "text" },
    { key: "seoDescription", label: "Mô tả SEO", type: "textarea" },
  ],
  filters: [
    { field: "status", label: "Trạng thái", options: statuses },
    { field: "productType", label: "Loại", options: productTypes },
    { field: "collection", label: "Bộ sưu tập", options: collectionOptions },
  ],
  columns: [
    {
      accessorKey: "name",
      header: "Sản phẩm",
      size: 300,
      cell: ({ row }) => (
        <Link to={("/admin/products/" + row.id) as "/admin"} className="a-table-name">
          {row.original.imageIds[0] ? (
            <MediaImage id={row.original.imageIds[0]} alt={row.original.name} className="a-thumb" />
          ) : (
            <span className="a-thumb a-thumb-letter">B</span>
          )}
          <span>
            <strong>{row.original.name}</strong>
            <small>{row.original.sku}</small>
          </span>
        </Link>
      ),
    },
    {
      accessorKey: "collection",
      header: "Bộ sưu tập",
      cell: ({ getValue }) =>
        collectionOptions.find((o) => o.value === getValue())?.label ?? String(getValue()),
    },
    { accessorKey: "price", header: "Giá", cell: ({ getValue }) => money(Number(getValue())) },
    { accessorKey: "stock", header: "Tồn kho" },
    {
      accessorKey: "status",
      header: "Trạng thái",
      cell: ({ getValue }) => (
        <Badge
          tone={
            getValue() === "published" ? "success" : getValue() === "draft" ? "warning" : "neutral"
          }
        >
          {statuses.find((s) => s.value === getValue())?.label}
        </Badge>
      ),
    },
  ],
};
export const categoryConfig = (
  kind: "product" | "content" | "genre",
  title: string,
): EntityConfig<"categories"> => ({
  entity: "categories",
  title,
  description: "Danh mục có cấp bậc; không cho phép vòng lặp hoặc xóa mục đang được sử dụng.",
  resource: kind === "content" ? "content" : kind === "genre" ? "bookstore" : "products",
  fixedFilters: { kind },
  defaults: {
    name: "",
    description: "",
    slug: "",
    kind,
    parentId: null,
    position: 0,
    active: true,
  },
  fields: [
    { key: "name", label: "Tên", type: "text", required: true },
    { key: "slug", label: "Đường dẫn", type: "text", required: true },
    {
      key: "parentId",
      label: "Danh mục cha",
      type: "select",
      entity: "categories",
      filter: { kind },
    },
    { key: "position", label: "Thứ tự", type: "number", min: 0 },
    { key: "active", label: "Hoạt động", type: "checkbox" },
    { key: "description", label: "Mô tả", type: "textarea", full: true },
  ],
});
