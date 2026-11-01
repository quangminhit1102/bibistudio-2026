import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/bookstore/authors")({
  component: lazyRouteComponent(() => import("@/features/admin/bookstore/pages/authors")),
});
