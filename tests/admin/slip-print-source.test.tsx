import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import SlipPrint from "../../src/features/admin/sales/components/slip-print";
const runtime = vi.hoisted(() => ({
  session: { userId: "admin" },
  ensure: vi.fn(async () => {}),
  service: vi.fn((entity: string) => ({
    get: async () =>
      entity === "customers"
        ? { name: "Khách liên kết", address: "Địa chỉ" }
        : { name: "Sản phẩm liên kết", sku: "001" },
  })),
}));
vi.mock("../../src/features/admin/services/context", () => ({ useAdmin: () => runtime }));
it("reads linked records without invoking any dataset initializer/migration", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <SlipPrint
        onClose={() => {}}
        slip={{
          id: "s",
          number: "PMH-2026-0002",
          createdAt: "2026-11-12T00:00:00Z",
          updatedAt: "2026-11-12T00:00:00Z",
          revision: 1,
          customerId: "c",
          customerSnapshot: { name: "Khách", address: "Địa chỉ", kind: "bookstore" },
          vatApplied: true,
          total: 26000,
          notes: "",
          status: "saved",
          voidedAt: null,
          voidReason: "",
          items: [
            { lineId: "l", productId: "p", sku: "001", name: "Sổ", quantity: 1, unitPrice: 26000 },
          ],
        }}
      />
    </QueryClientProvider>,
  );
  expect(await screen.findByLabelText("Tên khách hàng")).toHaveValue("Khách liên kết");
  expect(runtime.ensure).not.toHaveBeenCalled();
  view.unmount();
  client.clear();
});
