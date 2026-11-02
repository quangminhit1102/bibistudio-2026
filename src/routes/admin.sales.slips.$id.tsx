import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { RouteLeaf } from "@/lib/route-leaf";
const Page = lazyRouteComponent(() => import("@/features/admin/sales/pages/slip-detail"));
export const Route = createFileRoute("/admin/sales/slips/$id")({
  component: () => <RouteLeaf routeId={Route.id} page={Page} />,
});
