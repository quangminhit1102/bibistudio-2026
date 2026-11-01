import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/products/inventory")({
  component: lazyRouteComponent(() => import("@/features/admin/products/pages/inventory")),
});
