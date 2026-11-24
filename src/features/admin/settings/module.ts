import { Palette, Settings, UserRound } from "lucide-react";
import type { AdminModule } from "../modules";

/** The site-wide settings page. It has no resource of its own: profile pages share `settings`. */
export const settingsModule: AdminModule = {
  id: "settings",
  paths: ["/admin/settings/general"],
  browserOnly: true,
  items: [
    {
      group: "management",
      label: "Cài đặt chung",
      path: "/admin/settings/general",
      resource: "settings",
      icon: Settings,
    },
  ],
};

/** A user's own appearance and profile: always on. */
export const preferencesModule: AdminModule = {
  id: "core",
  paths: ["/admin/settings"],
  items: [
    {
      group: "management",
      label: "Giao diện",
      path: "/admin/settings/appearance",
      resource: "settings",
      icon: Palette,
    },
    {
      group: "management",
      label: "Hồ sơ",
      path: "/admin/settings/profile",
      resource: "settings",
      icon: UserRound,
    },
  ],
};
