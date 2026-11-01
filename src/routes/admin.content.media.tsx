import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/content/media")({
  component: lazyRouteComponent(() => import("@/features/admin/content/pages/media")),
});
