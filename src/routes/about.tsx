import { createFileRoute } from "@tanstack/react-router";
import { PageShell, PageIntro } from "@/components/page-shell";
import { Reveal } from "@/components/brand/reveal";
import { ContactBand } from "@/components/contact-cta";

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
        <img src="/catalogue/about-brand-world.webp" alt="Thế giới hình ảnh và sản phẩm giấy BiBi Studio" loading="lazy" className="aspect-[16/9] w-full object-cover md:aspect-[21/9]" />
      </section>
      <section className="mx-auto grid max-w-[1280px] gap-12 px-6 py-20 md:grid-cols-[5fr_7fr] md:py-28 lg:px-12">
        <Reveal>
          <h2 className="font-display text-4xl leading-tight md:text-5xl">Giấy có thể giữ một kỷ niệm.</h2>
        </Reveal>
        <Reveal className="space-y-6 text-[15px] leading-relaxed text-muted-foreground" delay={120}>
          <p className="font-display text-2xl italic leading-snug text-foreground">BiBi Studio bắt đầu từ niềm tin rằng những điều nhỏ bé vẫn có thể chạm đến trái tim.</p>
          <p>Đó có thể là một trang sổ giữ lại ý tưởng vừa đến, một tấm thiệp thay lời muốn nói, hay một hình ảnh quen thuộc khiến ta nhớ về một nơi từng đi qua. Với BiBi, đồ giấy không chỉ để sử dụng — chúng còn là cách ta nâng niu ký ức và trao đi sự quan tâm.</p>
          <p>Cảm hứng của studio đến từ Việt Nam rất đỗi đời thường: một ly cà phê sữa đá, hàng quán ven đường, mái phố cũ, dòng sông, tà áo dài và những công trình đã trở thành dấu nhớ của mỗi thành phố. Những hình ảnh ấy được kể lại bằng màu sắc ấm áp, gần gũi và một chút hoài niệm.</p>
        </Reveal>
      </section>
      <section className="bg-secondary/60">
        <div className="mx-auto grid max-w-[1280px] gap-12 px-6 py-20 md:grid-cols-2 md:items-center md:py-28 lg:px-12">
          <Reveal>
            <img src="/catalogue/about-product-table.webp" alt="Bộ sưu tập sổ tay và đồ giấy lấy cảm hứng từ Việt Nam" loading="lazy" className="aspect-[4/3] w-full object-cover" />
          </Reveal>
          <Reveal className="space-y-6" delay={120}>
            <p className="eyebrow">Những câu chuyện mang theo</p>
            <h2 className="font-display text-4xl leading-tight md:text-5xl">Từ Việt Nam, dành cho những người yêu điều chân thành.</h2>
            <div className="space-y-5 text-[15px] leading-relaxed text-muted-foreground">
              <p>Mỗi dòng sản phẩm là một cách kể chuyện khác nhau. Sổ tay dành cho những suy nghĩ riêng; thiệp dành cho lời nhắn gửi; postcard và magnet trở thành một mảnh ký ức nhỏ từ nơi chốn mình yêu.</p>
              <p>BiBi Studio mong rằng khi cầm một sản phẩm trên tay, bạn sẽ nhận ra một hương vị, một góc phố hoặc một cảm xúc quen thuộc — và muốn giữ nó gần mình lâu hơn.</p>
            </div>
          </Reveal>
        </div>
      </section>
      <Reveal as="section" className="mx-auto max-w-3xl px-6 py-24 text-center md:py-32">
        <p className="eyebrow">Touch your heart</p>
        <blockquote className="mt-6 font-display text-3xl italic leading-snug md:text-5xl">“Chúng tôi làm những món đồ nhỏ, để những câu chuyện và tình cảm có một nơi ở lại.”</blockquote>
      </Reveal>
      <ContactBand />
    </PageShell>
  );
}
