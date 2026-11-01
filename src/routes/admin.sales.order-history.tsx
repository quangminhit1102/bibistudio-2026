import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/sales/order-history")({
  component: lazyRouteComponent(() => import("@/features/admin/sales/pages/order-history")),
});
