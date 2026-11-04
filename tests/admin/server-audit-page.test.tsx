import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdminProvider } from "../../src/features/admin/services/context";
import { createHttpAuthService } from "../../src/features/admin/accounts/auth/http-service";
import { createAdminHttp } from "../../src/lib/admin-http";
import AuditLogs from "../../src/features/admin/audit/pages/audit-logs";
import { profile, grant, json, immediateLock } from "./helpers/http-client";
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useBlocker: () => ({ status: "idle" }),
  Link: ({ children }: React.PropsWithChildren) => <a>{children}</a>,
}));
test("audit page displays server events instead of fixture actors and mutation controls", async () => {
  localStorage.clear();
  const principal = { ...profile, fullAccess: true, isMaster: true };
  const event = {
    id: "123",
    actorId: "server-actor",
    action: "auth.login",
    targetType: "session",
    targetId: "server-session",
    metadata: {},
    createdAt: "2026-11-04T00:00:00Z",
  };
  const client = createAdminHttp({
    origin: "http://localhost",
    refreshLock: immediateLock,
    fetch: async (input) => {
      const path = new URL(String(input)).pathname;
      return json(
        path.endsWith("refresh")
          ? { ...grant("memory-admin"), profile: principal }
          : path.endsWith("profile")
            ? principal
            : { items: [event], total: 1, page: 1, pageSize: 20 },
      );
    },
  });
  const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={query}>
      <AdminProvider authFactory={() => createHttpAuthService({ client })}>
        <AuditLogs />
      </AdminProvider>
    </QueryClientProvider>,
  );
  expect(await screen.findByText("server-actor")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Xóa|Thêm mới/ })).not.toBeInTheDocument();
  view.unmount();
  query.clear();
});
