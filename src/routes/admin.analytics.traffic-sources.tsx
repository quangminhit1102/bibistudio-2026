import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/analytics/traffic-sources")({
  component: lazyRouteComponent(() => import("@/features/admin/analytics/pages/traffic-sources")),
});
