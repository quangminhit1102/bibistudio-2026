import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { site } from "@/platform/site";
export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: site.admin.title }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: lazyRouteComponent(() => import("@/features/admin/shell/admin-entry"), "AdminEntry"),
});
