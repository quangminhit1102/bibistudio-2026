import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/bookstore/")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/bookstore/books" as "/admin" });
  },
});
