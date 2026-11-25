import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  RouterProvider,
} from "@tanstack/react-router";
import type { AdminStore } from "../../src/features/admin/services/contracts";
import { AdminProvider } from "../../src/features/admin/services/context";
import { NoticeProvider } from "../../src/features/admin/shared/ui/primitives";
import CustomerList from "../../src/features/admin/customers/pages/list";
import { fixtureAuthFactory } from "./helpers/fixture-auth";
import { businessFixture } from "./business-fixtures";
import { workbook } from "./customer-import-fixture";
import * as customerApi from "../../src/features/admin/customers/api";
const runtime = vi.hoisted(() => ({ store: undefined as AdminStore | undefined }));
vi.mock("../../src/features/admin/demo/store", async (original) => {
  const actual = await original<typeof import("../../src/features/admin/demo/store")>();
  return {
    ...actual,
    createAdminStore: (...args: Parameters<typeof actual.createAdminStore>) =>
      runtime.store ?? actual.createAdminStore(...args),
  };
});
let f: Awaited<ReturnType<typeof businessFixture>>;
let client: QueryClient;
beforeEach(async () => {
  f = await businessFixture("customer-import-dialog");
  runtime.store = f.store;
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  localStorage.setItem("bibi-admin:session", JSON.stringify({ version: 2, session: f.session }));
});
afterEach(async () => {
  vi.restoreAllMocks();
  cleanup();
  client.clear();
  runtime.store = undefined;
  localStorage.clear();
  await f.store.destroy();
});
function mount() {
  const root = createRootRoute({ component: CustomerList });
  const route = createRoute({ getParentRoute: () => root, path: "/admin/customers" });
  const router = createRouter({
    routeTree: root.addChildren([route]),
    history: createMemoryHistory({ initialEntries: ["/admin/customers"] }),
  });
  render(
    <QueryClientProvider client={client}>
      <AdminProvider authFactory={fixtureAuthFactory}>
        <NoticeProvider>
          <RouterProvider router={router} />
        </NoticeProvider>
      </AdminProvider>
    </QueryClientProvider>,
  );
}
it("previews duplicates and errors, edits inline, explicitly creates duplicates, shows counts and refreshes the list", async () => {
  mount();
  const u = userEvent.setup();
  await u.type(await screen.findByRole("textbox", { name: "Tìm trong bảng" }), "Import Fixed");
  await u.click(await screen.findByRole("button", { name: "Import Excel" }));
  expect(await screen.findByRole("button", { name: "Tải file mẫu" })).toBeInTheDocument();
  const file = await workbook([
    ["Tên", "Email"],
    ["Import Example", ""],
    ["  IMPORT   EXAMPLE ", ""],
    ["", "bad"],
  ]);
  fireEvent.change(screen.getByLabelText("Chọn file .xlsx"), { target: { files: [file] } });
  expect(await screen.findByLabelText("Tên dòng 2")).toHaveValue("Import Example");
  await waitFor(() => expect(screen.getByLabelText("Xử lý dòng 3")).toHaveValue("skip"));
  expect(screen.getByRole("button", { name: /Xác nhận import/ })).toBeDisabled();
  await u.selectOptions(screen.getByLabelText("Xử lý dòng 3"), "create");
  fireEvent.change(screen.getByLabelText("Tên dòng 4"), { target: { value: "Import Fixed" } });
  fireEvent.change(screen.getByLabelText("Email dòng 4"), {
    target: { value: "fixed@example.test" },
  });
  await waitFor(() =>
    expect(screen.getByRole("button", { name: /Xác nhận import/ })).toBeEnabled(),
  );
  await u.click(screen.getByRole("button", { name: /Xác nhận import/ }));
  expect(await screen.findByText("Đã thêm 3, cập nhật 0, bỏ qua 0")).toBeInTheDocument();
  expect(await screen.findByRole("link", { name: /Import Fixed/ })).toBeInTheDocument();
  expect(
    (await f.store.list("customers")).filter((c) => c.name.toLowerCase().includes("import")),
  ).toHaveLength(3);
});
it("rejects invalid file selection without a writable preview and lets the user retry", async () => {
  mount();
  const u = userEvent.setup();
  await u.click(await screen.findByRole("button", { name: "Import Excel" }));
  fireEvent.change(await screen.findByLabelText("Chọn file .xlsx"), {
    target: { files: [new File(["bad"], "bad.csv")] },
  });
  expect(await screen.findByRole("alert")).toHaveTextContent(".xlsx");
  expect(screen.getByRole("button", { name: /Xác nhận import/ })).toBeDisabled();
});
it("hides import for a viewer without customer.create", async () => {
  localStorage.setItem(
    "bibi-admin:session",
    JSON.stringify({ version: 2, session: { userId: "user-4", roleId: "viewer" } }),
  );
  mount();
  await screen.findByRole("heading", { name: /Khách mua hàng/ });
  expect(screen.queryByRole("button", { name: "Import Excel" })).not.toBeInTheDocument();
});

it("reloads preview after a revision conflict and requires choosing the updated target again", async () => {
  const existing = (await f.store.get("customers", f.customerId))!;
  const original = customerApi.importCustomers;
  let raced = false;
  vi.spyOn(customerApi, "importCustomers").mockImplementation(async (runtime, input) => {
    if (!input.dryRun && !raced) {
      raced = true;
      await f.store.transaction(["customers"], async (tx) =>
        tx.put("customers", { ...existing, revision: existing.revision + 1 }),
      );
    }
    return original(runtime, input);
  });
  mount();
  const u = userEvent.setup();
  await u.click(await screen.findByRole("button", { name: "Import Excel" }));
  fireEvent.change(await screen.findByLabelText("Chọn file .xlsx"), {
    target: {
      files: [
        await workbook([
          ["Tên", "Người đại diện"],
          [existing.name, "Updated rep"],
        ]),
      ],
    },
  });
  const action = await screen.findByLabelText("Xử lý dòng 2");
  await waitFor(() => expect(action).toHaveValue("skip"));
  await u.selectOptions(action, `update:${existing.id}`);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: /Xác nhận import/ })).toBeEnabled(),
  );
  await u.click(screen.getByRole("button", { name: /Xác nhận import/ }));
  await waitFor(() => expect(action).toHaveValue("skip"));
  expect((await f.store.get("customers", existing.id))?.representative).not.toBe("Updated rep");
  await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  await u.selectOptions(action, `update:${existing.id}`);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: /Xác nhận import/ })).toBeEnabled(),
  );
  await u.click(screen.getByRole("button", { name: /Xác nhận import/ }));
  expect(await screen.findByText("Đã thêm 0, cập nhật 1, bỏ qua 0")).toBeInTheDocument();
});
