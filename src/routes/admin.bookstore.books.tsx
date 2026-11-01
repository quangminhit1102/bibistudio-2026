import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { RouteLeaf } from "@/lib/route-leaf";
const Page = lazyRouteComponent(() => import("@/features/admin/bookstore/pages/books"));
export const Route = createFileRoute("/admin/bookstore/books")({
  component: () => <RouteLeaf routeId={Route.id} page={Page} />,
});
