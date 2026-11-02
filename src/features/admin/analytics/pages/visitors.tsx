import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { EntityManager, type EntityConfig } from "../../shared/entity-manager";
import { internalTarget } from "../../shared/lib/navigation";
import { dateTime } from "../../shared/lib/text";
import { VisitorDialog } from "../components/visitor-dialog";
function visitorHref(id: string) {
  const q = new URLSearchParams(typeof location !== "undefined" ? location.search : "");
  q.set("visitor", id);
  return "/admin/analytics/visitors?" + q;
}
const config: EntityConfig<"visitors"> = {
  entity: "visitors",
  title: "Khách truy cập",
  description: "Thông tin và phiên truy cập mô phỏng. IP được che; không theo dõi khách thật.",
  readOnly: true,
  allowDelete: false,
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
  detailHref: visitorHref,
  filters: [
    {
      field: "country",
      label: "Vị trí",
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
      cell: ({ row }) => (
        <Link {...internalTarget(visitorHref(row.id))}>
          <strong>{row.original.anonymousId}</strong>
        </Link>
      ),
    },
    { accessorKey: "ipAddress", header: "IP" },
    {
      id: "location",
      header: "Vị trí",
      enableSorting: false,
      cell: ({ row }) => [row.original.city, row.original.country].filter(Boolean).join(", "),
    },
    {
      id: "device",
      header: "Thiết bị–Hệ điều hành",
      enableSorting: false,
      cell: ({ row }) => `${row.original.deviceType}–${row.original.operatingSystem}`,
    },
    { accessorKey: "browser", header: "Trình duyệt" },
    { accessorKey: "sessionCount", header: "Phiên" },
    {
      accessorKey: "lastSeenAt",
      header: "Lần cuối",
      cell: ({ getValue }) => dateTime(String(getValue())),
    },
  ],
  mobileRow: (v) => (
    <article className="a-visitor-card">
      <strong>{v.anonymousId}</strong>
      <p>{[v.city, v.country].filter(Boolean).join(", ")}</p>
      <p>
        {v.deviceType}–{v.operatingSystem} · {v.sessionCount} phiên
      </p>
      <small>{dateTime(v.lastSeenAt)}</small>
      <Link
        {...internalTarget(visitorHref(v.id))}
        className="a-btn"
        aria-label={`Xem thông tin ${v.anonymousId}`}
      >
        Xem thông tin
      </Link>
    </article>
  ),
};
export default function Visitors() {
  const navigate = useNavigate(),
    search = useSearch({ strict: false }) as Record<string, unknown>;
  const id = typeof search.visitor === "string" ? search.visitor : undefined;
  return (
    <>
      <EntityManager config={config} />
      {id && (
        <VisitorDialog
          key={id}
          visitorId={id}
          onClose={() =>
            void navigate({
              to: "/admin/analytics/visitors",
              search: { ...search, visitor: undefined } as never,
              replace: true,
            })
          }
        />
      )}
    </>
  );
}
