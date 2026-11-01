import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/components/")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/components/overview" as "/admin" });
  },
});
