import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/sales/transactions")({
  component: lazyRouteComponent(() => import("@/features/admin/sales/pages/transactions")),
});
