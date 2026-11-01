import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/audit-logs")({
  component: lazyRouteComponent(() => import("@/features/admin/audit/pages/audit-logs")),
});
