import { EntityManager, type EntityConfig } from "../../shared/entity-manager";
import { date } from "../../shared/lib/text";
const config: EntityConfig<"sessions"> = {
  entity: "sessions",
  title: "Phiên truy cập",
  description: "Phiên, nguồn và trang vào/ra trong bộ dữ liệu.",
  readOnly: true,
  dateField: "startedAt",
  defaultSort: { field: "startedAt", direction: "desc" },
  fields: [],
  defaults: {
    visitorId: "",
    startedAt: "",
    endedAt: null,
    landingPage: "",
    exitPage: "",
    referrer: "",
    pages: [],
  },
  columns: [
    { accessorKey: "id", header: "Session ID" },
    { accessorKey: "visitorId", header: "Visitor" },
    {
      accessorKey: "startedAt",
      header: "Bắt đầu",
      cell: ({ getValue }) => date(String(getValue())),
    },
    { accessorKey: "landingPage", header: "Trang vào" },
    { accessorKey: "exitPage", header: "Trang ra" },
    { accessorKey: "referrer", header: "Nguồn" },
    { id: "views", header: "Lượt xem", cell: ({ row }) => row.original.pages.length },
  ],
};
export default function Sessions() {
  return <EntityManager config={config} />;
}
