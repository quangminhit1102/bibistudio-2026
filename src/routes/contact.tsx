import { createFileRoute } from "@tanstack/react-router";
import { PageShell, PageIntro } from "@/components/page-shell";
import { ContactLinks } from "@/components/contact-cta";
import { contact } from "@/data/contact";

const title = "Liên hệ — BiBi Studio";
const description = "Liên hệ BiBi Studio qua điện thoại, Zalo, email hoặc Facebook để được tư vấn về sản phẩm.";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <PageShell>
      <PageIntro eyebrow="Liên hệ" title="Hãy trò chuyện cùng BiBi." lead="Bạn quan tâm đến một sản phẩm, muốn hợp tác hay đặt làm riêng? Liên hệ với chúng tôi qua bất kỳ kênh nào dưới đây." />
      <section className="mx-auto grid max-w-[1280px] gap-16 px-6 pb-28 md:grid-cols-2 lg:px-12">
        <div>
          <a href={`tel:${contact.phone}`} className="block font-display text-5xl leading-none transition hover:text-accent md:text-6xl">
            {contact.phoneDisplay}
          </a>
          <a href={`mailto:${contact.email}`} className="mt-6 block font-display text-2xl italic text-kraft hover:underline">
            {contact.email}
          </a>
        </div>
        <ContactLinks />
      </section>
    </PageShell>
  );
}
