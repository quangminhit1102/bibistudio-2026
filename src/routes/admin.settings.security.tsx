import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/settings/security")({
  component: lazyRouteComponent(() => import("@/features/admin/settings/pages/preferences")),
});
