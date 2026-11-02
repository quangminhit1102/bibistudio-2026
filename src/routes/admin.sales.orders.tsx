import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/sales/orders")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/sales/slips", replace: true });
  },
});
