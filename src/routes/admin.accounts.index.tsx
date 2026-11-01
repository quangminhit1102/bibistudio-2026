import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/accounts/")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/accounts/users" as "/admin" });
  },
});
