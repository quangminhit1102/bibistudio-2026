import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/bookstore/books/create")({
  component: lazyRouteComponent(() => import("@/features/admin/bookstore/pages/editor")),
});
