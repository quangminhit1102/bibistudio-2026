import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/sales/order-history")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/sales/slips", replace: true });
  },
});
