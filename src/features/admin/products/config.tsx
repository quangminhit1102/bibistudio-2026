import { Link } from "@tanstack/react-router";
import type { EntityConfig } from "../shared/entity-manager";
import type { FormField } from "../shared/forms/record-form";
import { Badge } from "../shared/ui/primitives";
import { MediaImage } from "../content/components/media-image";
import { money } from "../shared/lib/text";
import { RelationLabel } from "../shared/forms/relation-label";
import type { RelationSpec } from "../shared/forms/relation-options";
import { selectOptions, text } from "@/lib/catalogue-attributes";
export const statuses = [
  { value: "draft", label: "Nháp" },
  { value: "published", label: "Đang hiển thị" },
  { value: "hidden", label: "Đã ẩn" },
];
// A product stores its type's code and its collection's slug; both lists are managed
// in the admin, so the choices are read from there.
export const productTypeRelation: RelationSpec = { entity: "productTypes", valueKey: "code" };
export const collectionRelation: RelationSpec = {
  entity: "categories",
  filter: { kind: "product" },
  valueKey: "slug",
};
export const occasionOptions = selectOptions("occasion").map((o) => ({
  value: o.value,
  label: text(o.label) || o.value,
}));
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
    nameEn: "",
    productCode: "",
    slug: "",
    description: "",
    descriptionEn: "",
    shortDescription: "",
    shortDescriptionEn: "",
    productType: "",
    collection: "",
    categoryId: null,
    price: 0,
    compareAt: 0,
    stock: 0,
    reserved: 0,
    status: "draft",
    imageIds: [],
    tags: [],
    seoTitle: "",
    seoDescription: "",
    dimensions: "",
    pages: "",
    materialVi: "",
    materialEn: "",
    formatVi: "",
    formatEn: "",
    occasion: "",
    featured: false,
    sortOrder: 0,
    imageAltVi: "",
    imageAltEn: "",
  },
  fields: [
    { key: "name", label: "Tên sản phẩm", type: "text", required: true },
    { key: "nameEn", label: "Tên sản phẩm (English)", type: "text" },
    { key: "productCode", label: "Mã sản phẩm", type: "text", required: true },
    { key: "slug", label: "Đường dẫn", type: "text", required: true },
    { key: "status", label: "Trạng thái", type: "select", options: statuses },
    {
      key: "productType",
      label: "Loại sản phẩm",
      type: "select",
      required: true,
      ...productTypeRelation,
    },
    {
      key: "collection",
      label: "Bộ sưu tập",
      type: "select",
      required: true,
      ...collectionRelation,
    },
    {
      key: "categoryId",
      label: "Danh mục",
      type: "select",
      entity: "categories",
      filter: { kind: "product" },
    },
    { key: "price", label: "Giá (VND)", type: "number", min: 0 },
    { key: "compareAt", label: "Giá so sánh (VND)", type: "number", min: 0 },
    { key: "shortDescription", label: "Mô tả ngắn", type: "textarea", full: true },
    { key: "shortDescriptionEn", label: "Mô tả ngắn (English)", type: "textarea", full: true },
    { key: "description", label: "Mô tả (Tiếng Việt)", type: "textarea", full: true },
    { key: "descriptionEn", label: "Mô tả (English)", type: "textarea", full: true },
    { key: "dimensions", label: "Kích thước", type: "text" },
    { key: "pages", label: "Số trang", type: "text" },
    { key: "materialVi", label: "Chất liệu (Tiếng Việt)", type: "text" },
    { key: "materialEn", label: "Chất liệu (English)", type: "text" },
    { key: "formatVi", label: "Định dạng (Tiếng Việt)", type: "text" },
    { key: "formatEn", label: "Định dạng (English)", type: "text" },
    { key: "occasion", label: "Dịp lễ", type: "select", options: occasionOptions },
    { key: "featured", label: "Nổi bật", type: "checkbox" },
    { key: "sortOrder", label: "Thứ tự sắp xếp", type: "number", min: 0 },
    { key: "imageAltVi", label: "Alt ảnh (Tiếng Việt)", type: "text" },
    { key: "imageAltEn", label: "Alt ảnh (English)", type: "text" },
    { key: "imageIds", label: "Ảnh sản phẩm", type: "media", full: true },
    { key: "tags", label: "Thẻ", type: "tags", full: true },
    {
      key: "seoTitle",
      label: "Tiêu đề SEO",
      type: "text",
      description: "Để trống sẽ dùng tên sản phẩm.",
    },
    {
      key: "seoDescription",
      label: "Mô tả SEO",
      type: "textarea",
      description: "Để trống sẽ dùng mô tả ngắn.",
    },
  ],
  filters: [
    { field: "status", label: "Trạng thái", options: statuses },
    { field: "productType", label: "Loại", ...productTypeRelation },
    { field: "collection", label: "Bộ sưu tập", ...collectionRelation },
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
            <small>{row.original.productCode}</small>
          </span>
        </Link>
      ),
    },
    {
      accessorKey: "collection",
      header: "Bộ sưu tập",
      cell: ({ getValue }) => <RelationLabel spec={collectionRelation} value={getValue()} />,
    },
    { accessorKey: "price", header: "Giá", cell: ({ getValue }) => money(Number(getValue())) },
    { accessorKey: "stock", header: "Tồn kho" },
    {
      accessorKey: "status",
      header: "Trạng thái",
      cell: ({ getValue }) => (
        <Badge tone={getValue() === "published" ? "success" : "neutral"}>
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
    ...(kind === "product" ? collectionTextFields : []),
  ],
});
const imageField: FormField = {
  key: "image",
  label: "Ảnh",
  type: "text",
  full: true,
  description:
    "Đường dẫn ảnh (bắt đầu bằng /) hoặc mã ảnh trong thư viện. Để trống sẽ dùng ảnh mặc định của site.",
};
// What the public collection page shows besides the name and description.
const collectionTextFields: FormField[] = [
  { key: "nameEn", label: "Tên (English)", type: "text" },
  { key: "tagline", label: "Câu giới thiệu ngắn", type: "text", full: true },
  { key: "taglineEn", label: "Câu giới thiệu ngắn (English)", type: "text", full: true },
  { key: "introEn", label: "Mô tả (English)", type: "textarea", full: true },
  imageField,
];
export const productTypeConfig: EntityConfig<"productTypes"> = {
  entity: "productTypes",
  title: "Loại sản phẩm",
  description:
    "Mỗi sản phẩm thuộc một loại. Mã được lưu trên sản phẩm nên không đổi được sau khi tạo; đường dẫn là địa chỉ trang của loại.",
  defaults: {
    name: "",
    nameEn: "",
    plural: "",
    pluralEn: "",
    code: "",
    slug: "",
    description: "",
    taglineEn: "",
    image: "",
    position: 0,
    active: true,
  },
  fields: [
    { key: "name", label: "Tên", type: "text", required: true },
    { key: "nameEn", label: "Tên (English)", type: "text" },
    {
      key: "code",
      label: "Mã",
      type: "text",
      required: true,
      createOnly: true,
      description: "Chữ thường, số và dấu gạch nối, ví dụ: greeting-card.",
    },
    { key: "slug", label: "Đường dẫn", type: "text", required: true },
    { key: "plural", label: "Tên trên trang danh sách", type: "text" },
    { key: "pluralEn", label: "Tên trên trang danh sách (English)", type: "text" },
    { key: "position", label: "Thứ tự", type: "number", min: 0 },
    { key: "active", label: "Hoạt động", type: "checkbox" },
    { key: "description", label: "Câu giới thiệu ngắn", type: "textarea", full: true },
    { key: "taglineEn", label: "Câu giới thiệu ngắn (English)", type: "textarea", full: true },
    imageField,
  ],
};
