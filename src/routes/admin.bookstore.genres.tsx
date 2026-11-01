import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/bookstore/genres")({
  component: lazyRouteComponent(() => import("@/features/admin/bookstore/pages/genres")),
});
