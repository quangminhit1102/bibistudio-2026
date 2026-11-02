import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/bookstore/books")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/customers", replace: true });
  },
});
