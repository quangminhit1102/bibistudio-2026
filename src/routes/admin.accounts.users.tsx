import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { RouteLeaf } from "@/lib/route-leaf";
const Page = lazyRouteComponent(() => import("@/features/admin/accounts/pages/users"));
export const Route = createFileRoute("/admin/accounts/users")({
  component: () => <RouteLeaf routeId={Route.id} page={Page} />,
});
