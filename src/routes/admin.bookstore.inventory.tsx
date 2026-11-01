import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/bookstore/inventory")({
  component: lazyRouteComponent(() => import("@/features/admin/bookstore/pages/inventory")),
});
