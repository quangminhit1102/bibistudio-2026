import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/products/create")({
  component: lazyRouteComponent(() => import("@/features/admin/products/pages/editor")),
});
