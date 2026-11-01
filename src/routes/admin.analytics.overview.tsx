import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/analytics/overview")({
  component: lazyRouteComponent(() => import("@/features/admin/analytics/pages/overview")),
});
