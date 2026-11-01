import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { RouteLeaf } from "@/lib/route-leaf";
const Page = lazyRouteComponent(() => import("@/features/admin/customers/pages/detail"));
export const Route = createFileRoute("/admin/customers/$id")({
  component: () => <RouteLeaf routeId={Route.id} page={Page} />,
});
