import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/content/categories")({
  component: lazyRouteComponent(() => import("@/features/admin/content/pages/categories")),
});
