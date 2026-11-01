import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/accounts/permissions")({
  component: lazyRouteComponent(() => import("@/features/admin/accounts/pages/permissions")),
});
