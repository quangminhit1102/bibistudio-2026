import { createFileRoute } from "@tanstack/react-router";
import { MapPin, Navigation } from "lucide-react";
import { PageShell, PageIntro } from "@/components/page-shell";
import { ContactLinks } from "@/components/contact-cta";
import { Reveal } from "@/components/brand/reveal";
import { contact, studioLocation } from "@/data/contact";

const title = "Liên hệ — BiBi Studio";
const description =
  "Liên hệ BiBi Studio qua điện thoại, Zalo, email hoặc Facebook, và xem bản đồ vị trí tại Đường sách Nguyễn Văn Bình, Quận 1, TP. Hồ Chí Minh.";

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
      <PageIntro
        eyebrow="Liên hệ"
        title="Hãy trò chuyện cùng BiBi."
        lead="Bạn quan tâm đến một sản phẩm, muốn hợp tác hay đặt làm riêng? Liên hệ với chúng tôi qua bất kỳ kênh nào dưới đây."
      />
      <section className="mx-auto grid max-w-[1280px] gap-14 px-5 pb-28 sm:px-6 md:grid-cols-2 lg:px-12">
        <div>
          <a
            href={`tel:${contact.phone}`}
            className="block font-display text-[2.7rem] leading-none transition hover:text-accent sm:text-5xl md:text-6xl"
          >
            {contact.phoneDisplay}
          </a>
          <a
            href={`mailto:${contact.email}`}
            className="mt-6 block font-display text-2xl italic text-kraft hover:underline"
          >
            {contact.email}
          </a>
        </div>
        <ContactLinks />
      </section>

      <section className="border-t border-border bg-secondary/50">
        <div className="mx-auto max-w-[1280px] px-5 py-20 sm:px-6 md:py-28 lg:px-12">
          <Reveal className="max-w-2xl">
            <p className="eyebrow">Bản đồ</p>
            <h2 className="mt-4 font-display text-4xl leading-tight md:text-5xl">
              Ghé BiBi ở Đường sách.
            </h2>
            <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
              BiBi Studio hay có mặt ở Đường sách Nguyễn Văn Bình — nơi những trang sổ, tấm thiệp và
              postcard của studio đến gần bạn đọc hơn. Bạn muốn ghé qua hay hẹn gặp BiBi ở đó?
            </p>
          </Reveal>

          <div className="mt-12 grid gap-6 md:grid-cols-[1.7fr_1fr] md:items-stretch md:gap-8">
            <Reveal className="min-w-0">
              <div className="h-full border border-border bg-surface p-2">
                <iframe
                  title={`Bản đồ ${studioLocation.name}, ${studioLocation.address}`}
                  src={studioLocation.embed}
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                  className="h-[320px] w-full border-0 sm:h-[420px] md:h-full md:min-h-[440px]"
                />
              </div>
            </Reveal>

            <Reveal delay={120} className="min-w-0">
              <div className="flex h-full flex-col justify-between border border-border bg-surface p-7 sm:p-8">
                <div>
                  <span className="eyebrow">Vị trí</span>
                  <p className="mt-4 font-display text-2xl leading-snug text-foreground">
                    {studioLocation.name}
                  </p>
                  <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
                    {studioLocation.address}
                  </p>
                </div>
                <div className="mt-8 space-y-3">
                  <a
                    href={studioLocation.directions}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-12 w-full items-center justify-center gap-3 bg-foreground px-6 py-3.5 text-[12px] font-medium uppercase tracking-[0.22em] text-background transition hover:bg-accent"
                  >
                    <Navigation className="h-4 w-4 shrink-0" aria-hidden />
                    Chỉ đường
                  </a>
                  <a
                    href={studioLocation.maps}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-12 w-full items-center justify-center gap-3 border border-border px-6 py-3.5 text-[12px] font-medium uppercase tracking-[0.22em] text-foreground transition hover:border-kraft hover:text-kraft"
                  >
                    <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                    Mở trong Google Maps
                  </a>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
