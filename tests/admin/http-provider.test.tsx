import { afterEach, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdminProvider, useAdmin } from "../../src/features/admin/services/context";
import { can } from "../../src/features/admin/accounts/permissions";
import { profile, grant, json } from "./helpers/http-client";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  Reflect.deleteProperty(navigator, "locks");
});

test("default provider restores server identity and ignores a persisted fixture super-admin session", async () => {
  localStorage.setItem(
    "bibi-admin:session",
    JSON.stringify({ version: 2, session: { userId: "user-1", roleId: "super-admin" } }),
  );
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: async (_name: string, _options: unknown, work: () => Promise<unknown>) => work(),
    },
  });
  vi.stubGlobal("fetch", async (input: RequestInfo | URL) =>
    json(
      new URL(String(input)).pathname.endsWith("profile") ? profile : grant("memory-server-token"),
    ),
  );
  function Probe() {
    const { session, sessionLoading } = useAdmin();
    if (sessionLoading) return <span>Đang khôi phục</span>;
    return (
      <span>
        {session?.kind === "http" ? session.principal.username : "fixture"} ·{" "}
        {can(session, "analytics", "view") ? "visitor" : "no-visitor"} ·{" "}
        {can(session, "products", "view") ? "products" : "no-products"}
      </span>
    );
  }
  const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={query}>
      <AdminProvider>
        <Probe />
      </AdminProvider>
    </QueryClientProvider>,
  );
  expect(await screen.findByText("user01 · visitor · no-products")).toBeInTheDocument();
  expect(JSON.stringify(localStorage)).not.toContain("memory-server-token");
  view.unmount();
  query.clear();
});
