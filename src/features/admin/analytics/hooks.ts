import { useQuery } from "@tanstack/react-query";
import { useAdmin, useRole } from "../services/context";
import { requirePermission } from "../accounts/permissions";
import { aggregateAnalytics, previousRange, type DateRange } from "./aggregate";
import { loadDashboard } from "../dashboard/service";
export function useAnalytics(range: DateRange, includeBusiness = false) {
  const runtime = useAdmin();
  const role = useRole();
  return useQuery({
    queryKey: [
      "bibi-admin",
      "analytics-report",
      range,
      includeBusiness,
      runtime.session?.userId,
      runtime.session?.roleId,
    ],
    enabled: !!runtime.session && (runtime.session.kind === "http" || !role.isPending),
    queryFn: async () => {
      if (includeBusiness) return loadDashboard(runtime.store, runtime.session, range);
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
      return {
        rates: { current: 0, previous: 0 },
        categorySales: [],
        productCount: 0,
        activeUsers: 0,
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
