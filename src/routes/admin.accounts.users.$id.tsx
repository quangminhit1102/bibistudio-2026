import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/accounts/users/$id")({
  component: lazyRouteComponent(() => import("@/features/admin/accounts/pages/user-detail")),
});
