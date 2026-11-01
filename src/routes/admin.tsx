import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "BiBi Admin" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: lazyRouteComponent(() => import("@/features/admin/shell/admin-entry"), "AdminEntry"),
});
