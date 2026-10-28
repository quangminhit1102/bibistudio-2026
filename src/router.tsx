import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    basepath: import.meta.env.VITE_ROUTER_BASEPATH || "/",
    scrollRestoration: true,
    defaultViewTransition: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
