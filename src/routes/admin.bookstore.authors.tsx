import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/bookstore/authors")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/customers", replace: true });
  },
});
