import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/notifications")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/dashboard", replace: true });
  },
});
