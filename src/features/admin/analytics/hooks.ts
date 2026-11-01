import { useQuery } from "@tanstack/react-query";
import { useAdmin, useRole } from "../services/context";
import { requirePermission } from "../accounts/permissions";
import { aggregateAnalytics, aggregateOrders, previousRange, type DateRange } from "./aggregate";
export function useAnalytics(range: DateRange, includeBusiness = false) {
  const runtime = useAdmin();
  const role = useRole();
  return useQuery({
    queryKey: ["bibi-admin", "analytics-report", range, includeBusiness, runtime.session?.roleId],
    enabled: !!runtime.session && !role.isPending,
    queryFn: async () => {
      requirePermission(
        runtime.session,
        includeBusiness ? "dashboard" : "analytics",
        "view",
        role.data,
      );
      await runtime.ensure("sessions");
      const [visitors, sessions] = await Promise.all([
        runtime.store.list("visitors"),
        runtime.store.list("sessions"),
      ]);
      const current = aggregateAnalytics(visitors, sessions, range),
        previous = aggregateAnalytics(visitors, sessions, previousRange(range));
      if (includeBusiness) {
        await Promise.all([
          runtime.ensure("orders"),
          runtime.ensure("users"),
          runtime.ensure("notifications"),
        ]);
        const [orders, products, users, activity, notifications] = await Promise.all([
          runtime.store.list("orders"),
          runtime.store.list("products"),
          runtime.store.list("users"),
          runtime.store.list("audit"),
          runtime.store.list("notifications"),
        ]);
        return {
          current,
          previous,
          visitors,
          sessions,
          business: aggregateOrders(orders, range),
          previousBusiness: aggregateOrders(orders, previousRange(range)),
          products,
          users,
          activity,
          notifications,
        };
      }
      return {
        current,
        previous,
        visitors,
        sessions,
        business: null,
        previousBusiness: null,
        products: [],
        users: [],
        activity: [],
        notifications: [],
      };
    },
  });
}
