import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/analytics/pages")({
  component: lazyRouteComponent(() => import("@/features/admin/analytics/pages/pages")),
});
