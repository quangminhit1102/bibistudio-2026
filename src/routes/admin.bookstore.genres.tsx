import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/bookstore/genres")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/customers", replace: true });
  },
});
