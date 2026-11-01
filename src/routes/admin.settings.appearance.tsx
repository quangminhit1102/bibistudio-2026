import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/settings/appearance")({
  component: lazyRouteComponent(() => import("@/features/admin/settings/pages/appearance")),
});
