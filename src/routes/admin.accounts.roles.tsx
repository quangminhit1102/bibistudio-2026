import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/accounts/roles")({
  component: lazyRouteComponent(() => import("@/features/admin/accounts/pages/roles")),
});
