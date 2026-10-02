import { createFileRoute } from "@tanstack/react-router";
import { PageShell, PageIntro } from "@/components/page-shell";
import { Reveal } from "@/components/brand/reveal";
import { ContactBand } from "@/components/contact-cta";
import heroImg from "@/assets/hero-desk.jpg";

const title = "Về BiBi Studio — Touch your heart";
const description = "BiBi Studio là studio đồ giấy sáng tạo: sổ tay, thiệp, postcard và giấy viết thư lấy cảm hứng từ Việt Nam.";

export const Route = createFileRoute("/about")({
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
  component: AboutPage,
});

function AboutPage() {
  return (
    <PageShell>
      <PageIntro eyebrow="Về BiBi Studio" title="Một thế giới nhỏ làm từ giấy." lead="Touch your heart — chạm đến trái tim qua những món đồ giấy nhỏ bé." />
      <section className="mx-auto max-w-[1280px] px-6 lg:px-12">
        <img src={heroImg} alt="Đồ giấy BiBi Studio" loading="lazy" className="aspect-[21/9] w-full object-cover" />
      </section>
      <section className="mx-auto grid max-w-[1280px] gap-12 px-6 py-28 md:grid-cols-2 lg:px-12">
        <Reveal>
          <h2 className="font-display text-4xl leading-tight md:text-5xl">Giấy có thể giữ một kỷ niệm.</h2>
        </Reveal>
        <Reveal className="space-y-6 text-[15px] leading-relaxed text-muted-foreground" delay={120}>
          <p>BiBi Studio tạo nên những món đồ giấy cho khoảnh khắc thường ngày — một lời nhắn nhỏ, một nơi ta nhớ, một cảm xúc ta muốn giữ.</p>
          <p>Cảm hứng của chúng tôi đến từ Việt Nam: phố phường, món ăn, tà áo dài và nhịp sống quen thuộc, được kể lại qua sổ tay, thiệp, postcard, bao thư, giấy viết thư và magnet.</p>
          <p className="text-[13px] italic">Nội dung chi tiết về câu chuyện của studio sẽ được cập nhật.</p>
        </Reveal>
      </section>
      <ContactBand />
    </PageShell>
  );
}
