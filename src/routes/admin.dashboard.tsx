import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/dashboard")({
  component: lazyRouteComponent(() => import("@/features/admin/dashboard/pages/dashboard")),
});
