import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/content/posts/$id/edit")({
  component: lazyRouteComponent(() => import("@/features/admin/content/pages/editor")),
});
