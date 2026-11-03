import { expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEditorSession } from "../../src/features/admin/shared/forms/editor-session";
const state = vi.hoisted(() => ({
  row: { id: "p", name: "Original", revision: 1, createdAt: "x", updatedAt: "x" },
  update: vi.fn(async () => {}),
  dirty: false,
}));
vi.mock("../../src/features/admin/services/context", () => ({
  useAdmin: () => ({
    session: { userId: "u", roleId: "super-admin" },
    service: () => ({ update: state.update }),
  }),
  useRecord: () => ({ data: state.row, isPending: false, error: null }),
  useRole: () => ({ data: undefined }),
}));
vi.mock("../../src/features/admin/shared/forms/unsaved-guard", () => ({
  useUnsavedChanges: (dirty: boolean) => {
    state.dirty = dirty;
    return { status: "idle" };
  },
}));
it("holds the original revision across refetches and excludes protected input fields", async () => {
  const query = new QueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={query}>{children}</QueryClientProvider>
  );
  const { result, rerender } = renderHook(() => useEditorSession("products", "p"), { wrapper });
  act(() => result.current.dirtyChanged(true));
  state.row = { ...state.row, revision: 2 };
  rerender();
  await act(async () =>
    result.current.save({ name: "Changed", revision: 99, reserved: 100, id: "other" }),
  );
  expect(state.update).toHaveBeenCalledWith("p", expect.objectContaining({ name: "Changed" }), 1);
  expect(state.update.mock.calls[0][1]).not.toHaveProperty("reserved");
  expect(state.update.mock.calls[0][1]).not.toHaveProperty("revision");
  expect(state.dirty).toBe(false);
  query.clear();
});
