import { createFileRoute, lazyRouteComponent, redirect } from "@tanstack/react-router";
import { site } from "@/platform/site";
export const Route = createFileRoute("/admin")({
  // An address of a module the site has switched off leads to the dashboard. The manifests
  // load on demand so the public pages do not carry them.
  beforeLoad: async ({ location }) => {
    const { disabledAdminPath } = await import("@/features/admin/modules");
    if (disabledAdminPath(location.pathname))
      throw redirect({ to: "/admin/dashboard" as "/admin", replace: true });
  },
  head: () => ({
    meta: [{ title: site.admin.title }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: lazyRouteComponent(() => import("@/features/admin/shell/admin-entry"), "AdminEntry"),
});
