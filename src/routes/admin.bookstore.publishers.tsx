import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/bookstore/publishers")({
  component: lazyRouteComponent(() => import("@/features/admin/bookstore/pages/publishers")),
});
