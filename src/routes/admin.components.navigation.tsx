import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/components/navigation")({
  component: lazyRouteComponent(() => import("@/features/admin/components/page")),
});
