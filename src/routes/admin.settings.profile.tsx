import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/settings/profile")({
  component: lazyRouteComponent(() => import("@/features/admin/settings/pages/profile")),
});
