import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/products/types")({
  component: lazyRouteComponent(() => import("@/features/admin/products/pages/types")),
});
