import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { RouteLeaf } from "@/lib/route-leaf";
const Page = lazyRouteComponent(() => import("@/features/admin/content/pages/posts"));
export const Route = createFileRoute("/admin/content/posts")({
  component: () => <RouteLeaf routeId={Route.id} page={Page} />,
});
