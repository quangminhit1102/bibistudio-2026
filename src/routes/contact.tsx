import { createFileRoute } from "@tanstack/react-router";
import { t } from "@/lib/messages";
import ContactPage from "@/platform/pages/contact";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: t("contact.title") },
      { name: "description", content: t("contact.description") },
      { property: "og:title", content: t("contact.title") },
      { property: "og:description", content: t("contact.description") },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ContactPage,
});
