import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/components/charts")({
  component: lazyRouteComponent(() => import("@/features/admin/components/page")),
});
