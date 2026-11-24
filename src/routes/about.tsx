import { createFileRoute } from "@tanstack/react-router";
import { t } from "@/lib/messages";
import AboutPage from "@/platform/pages/about";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: t("about.title") },
      { name: "description", content: t("about.description") },
      { property: "og:title", content: t("about.title") },
      { property: "og:description", content: t("about.description") },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AboutPage,
});
