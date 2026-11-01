import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/components/feedback")({
  component: lazyRouteComponent(() => import("@/features/admin/components/page")),
});
