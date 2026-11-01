import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { RouteLeaf } from "@/lib/route-leaf";
const Page = lazyRouteComponent(() => import("@/features/admin/analytics/pages/visitors"));
export const Route = createFileRoute("/admin/analytics/visitors")({
  component: () => <RouteLeaf routeId={Route.id} page={Page} />,
});
