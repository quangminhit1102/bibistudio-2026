import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/analytics/sessions")({
  component: lazyRouteComponent(() => import("@/features/admin/analytics/pages/sessions")),
});
