import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdminProvider, useAdmin } from "../../src/features/admin/services/context";
import { createHttpAuthService } from "../../src/features/admin/accounts/auth/http-service";
import { createAdminHttp } from "../../src/lib/admin-http";
import { ServiceError } from "../../src/features/admin/services/errors";
import type { EntityService } from "../../src/features/admin/services/contracts";
import { profile, grant, json, immediateLock } from "./helpers/http-client";

const calls: string[] = [];
let postsService: EntityService<"posts"> | null = null;

function Probe() {
  const { session, sessionLoading, service } = useAdmin();
  if (sessionLoading) return <span>loading</span>;
  if (session?.kind !== "http") return <span>no-http</span>;
  postsService = service("posts") as EntityService<"posts">;
  let sessionsThrown = "";
  try {
    service("sessions");
  } catch (e) {
    sessionsThrown =
      e instanceof ServiceError ? "ServiceError:" + e.code : "raw:" + (e as Error).constructor.name;
  }
  return <span>{`posts-routed|${sessionsThrown}`}</span>;
}

test("routes content entities to HTTP service and forbids other server entities in HTTP mode", async () => {
  calls.length = 0;
  postsService = null;
  const client = createAdminHttp({
    origin: "http://localhost",
    refreshLock: immediateLock,
    fetch: async (input) => {
      const url = new URL(String(input));
      const path = url.pathname;
      calls.push(path + url.search);
      if (path.endsWith("refresh")) return json(grant("memory-admin"));
      if (path.endsWith("profile")) return json(profile);
      return json({ items: [], total: 0, page: 1, pageSize: 20 });
    },
  });
  const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={query}>
      <AdminProvider authFactory={() => createHttpAuthService({ client })}>
        <Probe />
      </AdminProvider>
    </QueryClientProvider>,
  );
  expect(await screen.findByText(/posts-routed\|ServiceError:forbidden/)).toBeInTheDocument();
  expect(postsService).not.toBeNull();
  await postsService!.list({ page: 1, pageSize: 10 });
  expect(calls).toContain("/api/posts?page=1&size=10");
  view.unmount();
  query.clear();
});
