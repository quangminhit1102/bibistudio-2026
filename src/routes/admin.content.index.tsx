import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/content/")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/content/posts" as "/admin" });
  },
});
