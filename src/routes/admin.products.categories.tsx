import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/products/categories")({
  component: lazyRouteComponent(() => import("@/features/admin/products/pages/categories")),
});
