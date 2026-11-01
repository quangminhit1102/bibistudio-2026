import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/customers/$id/edit")({
  component: lazyRouteComponent(() => import("@/features/admin/customers/pages/editor")),
});
