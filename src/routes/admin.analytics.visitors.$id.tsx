import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/analytics/visitors/$id")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/admin/analytics/visitors",
      search: { visitor: params.id } as never,
      replace: true,
    });
  },
});
