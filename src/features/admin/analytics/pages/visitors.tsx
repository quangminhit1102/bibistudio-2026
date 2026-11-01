import { Link } from "@tanstack/react-router";
import { EntityManager, type EntityConfig } from "../../shared/entity-manager";
import { date } from "../../shared/lib/text";
const config: EntityConfig<"visitors"> = {
  entity: "visitors",
  title: "Khách truy cập",
  description: "Danh tính ẩn danh và vị trí đều mô phỏng. IP được che; không xác định người thật.",
  readOnly: true,
  dateField: "lastSeenAt",
  defaultSort: { field: "lastSeenAt", direction: "desc" },
  fields: [],
  defaults: {
    anonymousId: "",
    ipAddress: "",
    country: "",
    city: "",
    deviceType: "",
    browser: "",
    operatingSystem: "",
    firstSeenAt: "",
    lastSeenAt: "",
    sessionCount: 0,
    pageViewCount: 0,
  },
  detailHref: (id) => `/admin/analytics/visitors/${id}`,
  filters: [
    {
      field: "country",
      label: "Quốc gia",
      options: ["Việt Nam", "Nhật Bản", "Hoa Kỳ"].map((v) => ({ value: v, label: v })),
    },
    {
      field: "deviceType",
      label: "Thiết bị",
      options: ["Mobile", "Desktop", "Tablet"].map((v) => ({ value: v, label: v })),
    },
    {
      field: "browser",
      label: "Trình duyệt",
      options: ["Chrome", "Safari", "Edge"].map((v) => ({ value: v, label: v })),
    },
  ],
  columns: [
    {
      accessorKey: "anonymousId",
      header: "Visitor ID",
      size: 220,
      cell: ({ row }) => (
        <Link to={("/admin/analytics/visitors/" + row.id) as "/admin"}>
          <strong>{row.original.anonymousId}</strong>
          <small>{row.original.ipAddress}</small>
        </Link>
      ),
    },
    { accessorKey: "country", header: "Quốc gia" },
    { accessorKey: "city", header: "Thành phố demo" },
    { accessorKey: "deviceType", header: "Thiết bị" },
    { accessorKey: "browser", header: "Trình duyệt" },
    { accessorKey: "operatingSystem", header: "Hệ điều hành" },
    { accessorKey: "sessionCount", header: "Phiên" },
    { accessorKey: "pageViewCount", header: "Trang xem" },
    {
      accessorKey: "lastSeenAt",
      header: "Lần cuối",
      cell: ({ getValue }) => date(String(getValue())),
    },
  ],
};
export default function Visitors() {
  return <EntityManager config={config} />;
}
