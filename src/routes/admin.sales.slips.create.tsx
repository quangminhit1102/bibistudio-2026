import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/sales/slips/create")({
  component: lazyRouteComponent(() => import("@/features/admin/sales/pages/slip-editor")),
});
