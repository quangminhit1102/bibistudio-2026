import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/content/posts/create")({
  component: lazyRouteComponent(() => import("@/features/admin/content/pages/editor")),
});
