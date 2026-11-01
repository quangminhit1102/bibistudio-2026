import { Outlet, useRouterState } from "@tanstack/react-router";
import type { ComponentType } from "react";
/** A page route may also parent create/detail/edit URLs. Only its leaf owns page content. */
export function RouteLeaf({ routeId, page: Page }: { routeId: string; page: ComponentType }) {
  const isLeaf = useRouterState({ select: (s) => s.matches.at(-1)?.routeId === routeId });
  return isLeaf ? <Page /> : <Outlet />;
}
