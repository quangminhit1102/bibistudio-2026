import { it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ServerAvatar } from "../../src/features/admin/accounts/server-avatar";
const runtime = vi.hoisted(() => ({ session: { userId: "one" }, http: { requestBlob: vi.fn() } }));
vi.mock("../../src/features/admin/services/context", () => ({ useAdmin: () => runtime }));
it("late old-user blob is never displayed and created URLs are revoked", async () => {
  const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:active"),
    revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  let finish!: (b: Blob) => void;
  runtime.http.requestBlob
    .mockImplementationOnce(() => new Promise((r) => (finish = r)))
    .mockResolvedValue(new Blob(["new"], { type: "image/png" }));
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const component = (id: string) => (
    <QueryClientProvider client={cache}>
      <ServerAvatar user={{ id, displayName: id, avatarId: "asset" }} />
    </QueryClientProvider>
  );
  const view = render(component("one"));
  await waitFor(() => expect(runtime.http.requestBlob).toHaveBeenCalledTimes(1));
  runtime.session = { userId: "two" };
  view.rerender(component("two"));
  await screen.findByAltText("two");
  finish(new Blob(["old"], { type: "image/png" }));
  await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
  expect(screen.queryByAltText("one")).not.toBeInTheDocument();
  view.unmount();
  expect(revoke).toHaveBeenCalledWith("blob:active");
  cache.clear();
});
