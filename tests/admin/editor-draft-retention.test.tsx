import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ComposeEditor from "../../src/features/admin/shared/forms/compose-editor";
import { postConfig } from "../../src/features/admin/content/config";
const state = vi.hoisted(() => ({
  error: null as Error | null,
  canEdit: true,
  initial: null as Record<string, unknown> | null,
}));
vi.mock("../../src/features/admin/shared/forms/editor-session", () => ({
  useEditorSession: () => ({
    initial: state.initial,
    hasDraft: true,
    canEdit: state.canEdit,
    error: state.error,
    loading: false,
    retry: () => {},
    dirtyChanged: () => {},
    blocker: { status: "idle" },
    save: async () => {},
  }),
}));
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useNavigate: () => () => {},
}));
vi.mock("../../src/features/admin/services/context", () => {
  const runtime = { ensure: async () => {}, store: { list: async () => [] } };
  return { useAdmin: () => runtime };
});
vi.mock("../../src/features/admin/content/components/rich-editor", async () => {
  const React = await import("react");
  return {
    default: ({ onReadyChange }: { onReadyChange?: (ready: boolean) => void }) => {
      React.useEffect(() => onReadyChange?.(true), [onReadyChange]);
      return <span>Editor</span>;
    },
  };
});
vi.mock("../../src/features/admin/content/components/media-picker", () => ({
  default: () => null,
}));
it("retains the same draft across background errors and permission changes while blocking writes", async () => {
  state.error = null;
  state.canEdit = true;
  state.initial = { ...postConfig.defaults, id: "p", title: "Gốc", slug: "goc" };
  const client = new QueryClient();
  const ui = (
    <QueryClientProvider client={client}>
      <ComposeEditor entity="posts" id="p" />
    </QueryClientProvider>
  );
  const { rerender } = render(ui);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/^Tiêu đề\s*\*?$/), " đang sửa");
  state.error = new Error("Mất kết nối");
  rerender(
    <QueryClientProvider client={client}>
      <ComposeEditor entity="posts" id="p" />
    </QueryClientProvider>,
  );
  expect(screen.getByLabelText(/^Tiêu đề\s*\*?$/)).toHaveValue("Gốc đang sửa");
  state.error = null;
  state.canEdit = false;
  rerender(
    <QueryClientProvider client={client}>
      <ComposeEditor entity="posts" id="p" />
    </QueryClientProvider>,
  );
  expect(screen.getByLabelText(/^Tiêu đề\s*\*?$/)).toHaveValue("Gốc đang sửa");
  expect(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeDisabled();
  state.canEdit = true;
  rerender(
    <QueryClientProvider client={client}>
      <ComposeEditor entity="posts" id="p" />
    </QueryClientProvider>,
  );
  expect(screen.getByLabelText(/^Tiêu đề\s*\*?$/)).toHaveValue("Gốc đang sửa");
  client.clear();
});
