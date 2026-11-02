import { useQuery } from "@tanstack/react-query";
import { useAdmin } from "../services/context";
import { authorizeOperation } from "../accounts/permissions";
export function useSlipOptions() {
  const runtime = useAdmin();
  return useQuery({
    queryKey: ["bibi-admin", "slip-options", runtime.session?.userId],
    enabled: !!runtime.session,
    queryFn: async () => {
      const active = await authorizeOperation(runtime.store, runtime.session, "sales", "view");
      await runtime.ensure("customers");
      const [customers, products] = await Promise.all([
        runtime.store.list("customers"),
        runtime.store.list("products"),
      ]);
      active();
      return { customers, products };
    },
  });
}
