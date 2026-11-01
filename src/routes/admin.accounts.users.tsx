import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/accounts/users")({
  component: lazyRouteComponent(() => import("@/features/admin/accounts/pages/users")),
});
