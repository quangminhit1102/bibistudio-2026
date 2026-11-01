import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/analytics/visitors/$id")({
  component: lazyRouteComponent(() => import("@/features/admin/analytics/pages/visitor-detail")),
});
