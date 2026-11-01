import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/content/tags")({
  component: lazyRouteComponent(() => import("@/features/admin/content/pages/tags")),
});
