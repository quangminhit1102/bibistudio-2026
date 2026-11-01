import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/components/overlays")({
  component: lazyRouteComponent(() => import("@/features/admin/components/page")),
});
