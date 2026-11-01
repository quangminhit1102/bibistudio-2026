import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { RouteLeaf } from "@/lib/route-leaf";
const Page = lazyRouteComponent(() => import("@/features/admin/sales/pages/orders"));
export const Route = createFileRoute("/admin/sales/orders")({
  component: () => <RouteLeaf routeId={Route.id} page={Page} />,
});
