import type { AdminModule } from "../modules";

export const notificationsModule: AdminModule = {
  id: "notifications",
  resource: "notifications",
  paths: ["/admin/notifications"],
  browserOnly: true,
  items: [],
};
