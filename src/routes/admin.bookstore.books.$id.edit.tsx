import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/bookstore/books/$id/edit")({
  component: lazyRouteComponent(() => import("@/features/admin/bookstore/pages/editor")),
});
