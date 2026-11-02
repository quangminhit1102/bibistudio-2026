import { it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdminProvider, useAdmin } from "../../src/features/admin/services/context";
function saved(userId: string, roleId: string) {
  localStorage.setItem(
    "bibi-admin:session",
    JSON.stringify({ version: 2, session: { userId, roleId } }),
  );
}
it("an account switch or logout in another tab invalidates the local session", async () => {
  saved("user-1", "super-admin");
  const client = new QueryClient();
  function Probe() {
    const runtime = useAdmin();
    return <span>{runtime.session?.roleId ?? "logged-out"}</span>;
  }
  render(
    <QueryClientProvider client={client}>
      <AdminProvider>
        <Probe />
      </AdminProvider>
    </QueryClientProvider>,
  );
  expect(await screen.findByText("super-admin")).toBeInTheDocument();
  await act(async () => {
    saved("user-4", "viewer");
    window.dispatchEvent(new StorageEvent("storage", { key: "bibi-admin:session" }));
  });
  expect(await screen.findByText("viewer")).toBeInTheDocument();
  await act(async () => {
    localStorage.removeItem("bibi-admin:session");
    window.dispatchEvent(new StorageEvent("storage", { key: "bibi-admin:session" }));
  });
  expect(await screen.findByText("logged-out")).toBeInTheDocument();
  client.clear();
});
