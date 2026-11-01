import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/notifications")({
  component: lazyRouteComponent(() => import("@/features/admin/notifications/pages/notifications")),
});
