import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/analytics/overview")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/analytics/visitors" as "/admin", replace: true });
  },
});
