import { createFileRoute, Link } from "@tanstack/react-router";
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

const values = [
  {
    number: "01",
    title: "Kể chuyện bằng hình",
    body: "Mỗi sản phẩm bắt đầu từ một câu chuyện — một con phố, một món ăn, một giai điệu của Sài Gòn hay một tà áo dài. Trước khi cầm bút, chúng tôi tự hỏi: món đồ này sẽ gợi nhớ điều gì?",
  },
  {
    number: "02",
    title: "Vẽ tay và tỉ mỉ",
    body: "Họa tiết, bảng màu và chữ viết đều được vẽ và chọn lựa riêng cho từng dòng sản phẩm. Chúng tôi chấp nhận làm chậm hơn để từng đường nét thật sự gần gũi và có hồn.",
  },
  {
    number: "03",
    title: "Nhỏ nhưng có tâm",
    body: "Một tấm thiệp hay một trang sổ có thể nhỏ, nhưng được chăm chút từ khâu chọn giấy đến khâu hoàn thiện. Những điều nhỏ bé, khi được nâng niu, sẽ chạm đến trái tim sâu hơn.",
  },
];

const steps = [
  {
    step: "Bước 1",
    title: "Gather — Gom nhặt",
    body: "Chúng tôi đi, nhìn, chụp ảnh và ghi lại những khoảnh khắc đời thường của Việt Nam: quán cà phê góc phố, bến nước, mái chùa, làn áo dài.",
  },
  {
    step: "Bước 2",
    title: "Sketch — Phác thảo",
    body: "Từ những ghi chú đó, họa tiết và bố cục được vẽ phác bằng tay. Ở giai đoạn này, BiBi cố giữ sự tự nhiên và chân thật trong từng nét.",
  },
  {
    step: "Bước 3",
    title: "Tell — Kể lại",
    body: "Bản thảo được chuyển thành sản phẩm: trang bìa, thiệp, postcard hay magnet — nơi câu chuyện được kể lại bằng màu sắc ấm áp và hoài niệm.",
  },
  {
    step: "Bước 4",
    title: "Touch — Chạm",
    body: "Sản phẩm cuối cùng đến tay người dùng: một món đồ giấy nhỏ để viết, để tặng, để dán lên tủ lạnh — và để giữ một kỷ niệm lại gần mình hơn.",
  },
];

const gallery = [
  { src: "/catalogue/collection-explore-vietnam.webp", alt: "Bộ sưu tập Explore Vietnam", caption: "Explore Vietnam" },
  { src: "/catalogue/notebook-ca-phe.webp", alt: "Sổ tay minh họa ly cà phê Việt", caption: "Cà phê" },
  { src: "/catalogue/card-hoi-an.webp", alt: "Thiệp minh họa phố cổ Hội An", caption: "Hội An" },
  { src: "/catalogue/magnet-ho-guom.webp", alt: "Magnet Hồ Gươm", caption: "Hồ Gươm" },
];

function AboutPage() {
  return (
    <PageShell>
      <PageIntro eyebrow="Về BiBi Studio" title="Một thế giới nhỏ làm từ giấy." lead="Touch your heart — chạm đến trái tim qua những món đồ giấy nhỏ bé." />

      <section className="mx-auto max-w-[1280px] px-5 sm:px-6 lg:px-12">
        <Reveal>
          <img src="/Images/GPT-Update/Vietnam Watercolor Travel Notebook Collection.png" alt="Thế giới hình ảnh và sản phẩm giấy BiBi Studio" loading="lazy" className="aspect-[16/9] w-full object-cover md:aspect-[21/9]" />
        </Reveal>
      </section>

      {/* Câu chuyện */}
      <section className="mx-auto grid max-w-[1280px] gap-12 px-5 py-20 sm:px-6 md:grid-cols-[5fr_7fr] md:py-28 lg:px-12">
        <Reveal>
          <p className="eyebrow">Câu chuyện của chúng tôi</p>
          <h2 className="mt-4 font-display text-4xl leading-tight md:text-5xl">Giấy có thể giữ một kỷ niệm.</h2>
        </Reveal>
        <Reveal className="space-y-6 text-[15px] leading-relaxed text-muted-foreground" delay={120}>
          <p className="font-display text-2xl italic leading-snug text-foreground">BiBi Studio bắt đầu từ niềm tin rằng những điều nhỏ bé vẫn có thể chạm đến trái tim.</p>
          <p>Đó có thể là một trang sổ giữ lại ý tưởng vừa đến, một tấm thiệp thay lời muốn nói, hay một hình ảnh quen thuộc khiến ta nhớ về một nơi từng đi qua. Với BiBi, đồ giấy không chỉ để sử dụng — chúng còn là cách ta nâng niu ký ức và trao đi sự quan tâm.</p>
          <p>Cảm hứng của studio đến từ Việt Nam rất đỗi đời thường: một ly cà phê sữa đá, hàng quán ven đường, mái phố cũ, dòng sông, tà áo dài và những công trình đã trở thành dấu nhớ của mỗi thành phố. Những hình ảnh ấy được kể lại bằng màu sắc ấm áp, gần gũi và một chút hoài niệm.</p>
          <p>Chúng tôi tin rằng trong một thế giới di chuyển rất nhanh, người ta vẫn cần những điều chậm rãi: một trang giấy mịn dưới ngòi bút, một tấm bưu thiếp ai đó gửi từ xa về, hay một tờ giấy nhớ trên bàn làm việc mang chút hơi ấm của phố phường.</p>
        </Reveal>
      </section>

      {/* Giá trị */}
      <section className="bg-secondary/60">
        <div className="mx-auto max-w-[1280px] px-5 py-20 sm:px-6 md:py-28 lg:px-12">
          <Reveal className="max-w-2xl">
            <p className="eyebrow">Điều BiBi tin</p>
            <h2 className="mt-4 font-display text-4xl leading-tight md:text-5xl">Ba điều chúng tôi luôn giữ khi làm đồ giấy.</h2>
          </Reveal>
          <div className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
            {values.map((v, i) => (
              <Reveal key={v.number} delay={i * 120} className="border-t border-border pt-6">
                <span className="font-display text-3xl text-kraft">{v.number}</span>
                <h3 className="mt-4 text-xl font-medium">{v.title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{v.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Sản phẩm & câu chuyện */}
      <section className="mx-auto grid max-w-[1280px] gap-12 px-5 py-20 sm:px-6 md:grid-cols-2 md:items-center md:py-28 lg:px-12">
        <Reveal className="overflow-hidden">
          <img src="Images\GPT-Update\Vietnam Illustrated Travel Postcard Collection-2.png" alt="Bộ sưu tập sổ tay và đồ giấy lấy cảm hứng từ Việt Nam" loading="lazy" className="aspect-[4/3] w-full object-cover transition-transform duration-700 ease-out hover:scale-[1.04]" />
        </Reveal>
        <Reveal className="space-y-6" delay={120}>
          <p className="eyebrow">Những câu chuyện mang theo</p>
          <h2 className="font-display text-4xl leading-tight md:text-5xl">Từ Việt Nam, dành cho những người yêu điều chân thành.</h2>
          <div className="space-y-5 text-[15px] leading-relaxed text-muted-foreground">
            <p>Mỗi dòng sản phẩm là một cách kể chuyện khác nhau. Sổ tay dành cho những suy nghĩ riêng; thiệp dành cho lời nhắn gửi; postcard và magnet trở thành một mảnh ký ức nhỏ từ nơi chốn mình yêu.</p>
            <p>BiBi Studio mong rằng khi cầm một sản phẩm trên tay, bạn sẽ nhận ra một hương vị, một góc phố hoặc một cảm xúc quen thuộc — và muốn giữ nó gần mình lâu hơn.</p>
          </div>
        </Reveal>
      </section>

      {/* Hành trình 4 bước */}
      <section className="bg-secondary/60">
        <div className="mx-auto max-w-[1280px] px-5 py-20 sm:px-6 md:py-28 lg:px-12">
          <Reveal className="max-w-2xl">
            <p className="eyebrow">Cách một món đồ ra đời</p>
            <h2 className="mt-4 font-display text-4xl leading-tight md:text-5xl">Từ một câu chuyện đến một món đồ nhỏ.</h2>
          </Reveal>
          <div className="mt-14 grid gap-10 sm:grid-cols-2 md:gap-x-10 lg:grid-cols-4">
            {steps.map((s, i) => (
              <Reveal key={s.step} delay={i * 100} className="border-t border-border pt-6">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-kraft">{s.step}</p>
                <h3 className="mt-3 font-display text-2xl">{s.title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{s.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Dải ảnh sản phẩm */}
      <section className="mx-auto max-w-[1280px] px-5 py-20 sm:px-6 md:py-28 lg:px-12">
        <Reveal className="max-w-2xl">
          <p className="eyebrow">Góc nhìn sản phẩm</p>
          <h2 className="mt-4 font-display text-4xl leading-tight md:text-5xl">Những mảnh Việt Nam, dựng bằng giấy.</h2>
        </Reveal>
        <div className="mt-12 grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
          {gallery.map((g, i) => (
            <Reveal key={g.src} delay={i * 100} className="group">
              <div className="overflow-hidden">
                <img src={g.src} alt={g.alt} loading="lazy" className="aspect-[4/5] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]" />
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{g.caption}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <Reveal as="section" className="mx-auto max-w-3xl px-5 py-24 text-center sm:px-6 md:py-32">
        <p className="eyebrow">Touch your heart</p>
        <blockquote className="mt-6 font-display text-3xl italic leading-snug md:text-5xl">“Chúng tôi làm những món đồ nhỏ, để những câu chuyện và tình cảm có một nơi ở lại.”</blockquote>
      </Reveal>

      {/* CTA khám phá */}
      <section className="mx-auto grid max-w-[1280px] gap-4 px-5 pb-24 sm:grid-cols-2 sm:px-6 md:pb-28 lg:px-12">
        <Reveal>
          <Link to="/products" className="group block border border-border bg-surface px-8 py-10 transition-colors hover:bg-secondary/60 sm:py-12">
            <p className="eyebrow">Khám phá</p>
            <span className="mt-3 flex items-center justify-between font-display text-3xl md:text-4xl">
              Xem tất cả sản phẩm
              <span aria-hidden className="text-kraft transition-transform duration-300 group-hover:translate-x-1">→</span>
            </span>
          </Link>
        </Reveal>
        <Reveal delay={120}>
          <Link to="/collections" className="group block border border-border bg-surface px-8 py-10 transition-colors hover:bg-secondary/60 sm:py-12">
            <p className="eyebrow">Bộ sưu tập</p>
            <span className="mt-3 flex items-center justify-between font-display text-3xl md:text-4xl">
              Các chương của BiBi
              <span aria-hidden className="text-kraft transition-transform duration-300 group-hover:translate-x-1">→</span>
            </span>
          </Link>
        </Reveal>
      </section>

      <ContactBand />
    </PageShell>
  );
}
