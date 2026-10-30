// Magazine-style footer: brand story · products · collections · contact & map, giant wordmark at the base.
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, MapPin } from "lucide-react";
import { BrandLogo } from "./brand-logo";
import { Reveal } from "./brand/reveal";
import { collections, productTypes, tx } from "@/data/catalogue";
import { contact, studioLocation } from "@/data/contact";

function Col({ title, children, delay = 0 }: { title: string; children: React.ReactNode; delay?: number }) {
  return (
    <Reveal delay={delay} className="min-w-0">
      <h3 className="eyebrow mb-6 flex items-center gap-3 text-foreground">
        <span className="h-px w-6 bg-kraft" />
        {title}
      </h3>
      {children}
    </Reveal>
  );
}

const linkCls = "group inline-flex items-center gap-1.5 text-[14px] text-foreground/80 transition hover:translate-x-1 hover:text-foreground";

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-border bg-background">
      <div className="mx-auto max-w-[1280px] px-5 pt-20 sm:px-6 lg:px-12">
        <div className="grid gap-x-10 gap-y-14 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1.3fr]">
          <Reveal className="min-w-0 sm:col-span-2 lg:col-span-1">
            <BrandLogo />
            <p className="mt-8 max-w-xs font-display text-[1.7rem] italic leading-[1.15] text-foreground">
              Little things, <span className="text-kraft">made to touch</span> your heart.
            </p>
            <p className="mt-5 max-w-xs text-[14px] leading-relaxed text-muted-foreground">
              Một studio nhỏ làm đồ giấy lấy cảm hứng từ Việt Nam — mỗi sản phẩm bắt đầu từ một câu chuyện.
            </p>
            <Link to="/about" className="mt-6 inline-flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-[0.2em] underline underline-offset-8 hover:text-accent">
              Câu chuyện BiBi <ArrowUpRight className="size-3.5" />
            </Link>
          </Reveal>

          <Col title="Sản phẩm" delay={80}>
            <ul className="space-y-3">
              {productTypes.map((t) => (
                <li key={t.id}><Link to="/products/$slug" params={{ slug: t.slug }} className={linkCls}>{tx(t.plural)}</Link></li>
              ))}
              <li><Link to="/blog" className={linkCls}>Nhật ký</Link></li>
            </ul>
          </Col>

          <Col title="Bộ sưu tập" delay={160}>
            <ul className="space-y-3">
              {collections.map((c) => (
                <li key={c.id}><Link to="/collections/$slug" params={{ slug: c.slug }} className={linkCls}>{tx(c.name)}</Link></li>
              ))}
            </ul>
          </Col>

          <Col title="Liên hệ" delay={240}>
            <a href={`tel:${contact.phone}`} className="block font-display text-3xl leading-none transition hover:text-accent">
              {contact.phoneDisplay}
            </a>
            <a href={`mailto:${contact.email}`} className="mt-3 block break-all text-[14px] text-foreground/80 hover:text-foreground">
              {contact.email}
            </a>
            <div className="mt-5 flex flex-wrap gap-2">
              {[
                ["Zalo", contact.zalo],
                ["Facebook", contact.facebook],
                ["Messenger", contact.messenger],
              ].map(([label, href]) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer" className="border border-border px-3 py-1.5 text-[12px] transition hover:border-foreground hover:bg-secondary">
                  {label}
                </a>
              ))}
            </div>
            <a href={studioLocation.maps} target="_blank" rel="noopener noreferrer" className="group mt-6 block overflow-hidden border border-border">
              <div className="relative h-28 overflow-hidden bg-secondary">
                <iframe
                  title="Bản đồ BiBi Studio"
                  src={studioLocation.embed}
                  loading="lazy"
                  tabIndex={-1}
                  className="pointer-events-none h-[180%] w-full -translate-y-[20%] border-0 grayscale-[0.6] transition duration-700 group-hover:grayscale-0"
                />
              </div>
              <div className="flex items-start gap-2 p-3 text-[12px] leading-snug text-muted-foreground">
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-kraft" />
                <span><span className="text-foreground">{studioLocation.name}</span><br />{studioLocation.address}</span>
              </div>
            </a>
          </Col>
        </div>
      </div>

      <div aria-hidden className="pointer-events-none mt-16 select-none overflow-hidden px-3">
        <p className="footer-wordmark whitespace-nowrap text-center font-display leading-[0.8] text-secondary">
          BiBi Studio
        </p>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-2 px-5 pb-24 pt-5 text-[11px] tracking-wider text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 md:pb-5 lg:px-12">
          <p>© {new Date().getFullYear()} BiBi Studio · Touch your heart</p>
          <p className="flex gap-5">
            <Link to="/about" className="hover:text-foreground">Về BiBi</Link>
            <Link to="/contact" className="hover:text-foreground">Liên hệ</Link>
            <Link to="/api-test" className="hover:text-foreground">Kiểm tra API</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
