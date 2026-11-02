import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { RouteLeaf } from "@/lib/route-leaf";
const Page = lazyRouteComponent(() => import("@/features/admin/analytics/pages/visitors"));
export const Route = createFileRoute("/admin/analytics/visitors")({
  validateSearch: (search: Record<string, unknown>) =>
    Object.fromEntries(
      Object.entries(search).filter(
        ([key, value]) =>
          [
            "visitor",
            "q",
            "page",
            "size",
            "sort",
            "dir",
            "f_country",
            "f_city",
            "f_deviceType",
            "f_browser",
            "f_from",
            "f_to",
          ].includes(key) &&
          (typeof value === "string" || typeof value === "number") &&
          (key !== "visitor" || (typeof value === "string" && value.length <= 200)),
      ),
    ),
  component: () => <RouteLeaf routeId={Route.id} page={Page} />,
});
