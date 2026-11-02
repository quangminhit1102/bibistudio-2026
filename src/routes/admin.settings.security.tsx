import { createFileRoute, Navigate } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/settings/security")({
  component: () => <Navigate to="/admin/settings/profile" replace />,
});
