import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/sales/reports")({
  component: lazyRouteComponent(() => import("@/features/admin/sales/pages/reports")),
});
