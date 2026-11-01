import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/products/list")({
  component: lazyRouteComponent(() => import("@/features/admin/products/pages/list")),
});
