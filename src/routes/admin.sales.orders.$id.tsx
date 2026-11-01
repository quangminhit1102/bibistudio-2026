import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/sales/orders/$id")({
  component: lazyRouteComponent(() => import("@/features/admin/sales/pages/order-detail")),
});
