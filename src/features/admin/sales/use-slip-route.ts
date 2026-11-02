import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useAdmin } from "../services/context";
import { resolveSlipRoute } from "./slip-route";
export function useSlipRoute(token: string) {
  const runtime = useAdmin(),
    navigate = useNavigate();
  const location = useRouterState({ select: (s) => s.location });
  const record = useQuery({
    queryKey: ["bibi-admin", "purchaseSlips", "route", token, runtime.session?.userId],
    enabled: !!token && !!runtime.session,
    queryFn: async ({ signal }) => {
      await runtime.ensure("purchaseSlips");
      const resolved = await resolveSlipRoute(runtime.store, token);
      return runtime.service("purchaseSlips").get(resolved.id, signal);
    },
  });
  const number = record.data?.number;
  useEffect(() => {
    if (!number || number === token) return;
    const suffix = location.pathname.endsWith("/edit") ? "/edit" : "";
    void navigate({
      to: ("/admin/sales/slips/" + encodeURIComponent(number) + suffix) as "/admin",
      search: location.search as never,
      hash: location.hash,
      replace: true,
    });
  }, [number, token, navigate, location.pathname, location.search, location.hash]);
  return record;
}
