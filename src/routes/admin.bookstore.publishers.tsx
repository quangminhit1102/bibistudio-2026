import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/bookstore/publishers")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/customers", replace: true });
  },
});
