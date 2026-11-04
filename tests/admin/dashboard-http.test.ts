import { expect, test, vi } from "vitest";
import { createAdminHttp } from "../../src/lib/admin-http";
import { loadServerDashboard } from "../../src/features/admin/dashboard/service";
import { json, profile, grant, immediateLock } from "./helpers/http-client";
test("HTTP dashboard uses real account and visitor totals, never fixture identities or invented trends", async () => {
  const requests: string[] = [];
  const client = createAdminHttp({
    origin: "http://localhost",
    refreshLock: immediateLock,
    fetch: async (input) => {
      const path = new URL(String(input)).pathname;
      requests.push(path);
      if (path.endsWith("refresh"))
        return json({ ...grant("memory"), profile: { ...profile, fullAccess: true } });
      if (path.endsWith("profile")) return json({ ...profile, fullAccess: true });
      if (path.endsWith("report"))
        return json({
          totalVisitors: 7,
          totalSessions: 11,
          products: [{ slug: "a", name: "Sổ A", interestedVisitors: 3 }],
        });
      return json({ items: [], total: 4, page: 1, pageSize: 1 });
    },
  });
  await client.restore();
  const result = await loadServerDashboard(client, { ...profile, fullAccess: true });
  expect(result.visitors?.totalVisitors).toBe(7);
  expect(result.accounts).toBe(4);
  expect(result).not.toHaveProperty("previous");
  expect(result).not.toHaveProperty("trend");
  expect(requests).toContain("/api/accounts");
  expect(requests).toContain("/api/customer-access/report");
  const restricted = await loadServerDashboard(client, {
    ...profile,
    permissions: ["dashboard.view"],
    fullAccess: false,
  });
  expect(restricted).toEqual({ visitors: null, accounts: null });
});
