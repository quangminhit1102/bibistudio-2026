// Brand-catalogue header: home · products · collections · journal · about · contact · search · language.
import { ArrowRight, Menu, Phone, X } from "lucide-react";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { BrandLogo } from "./brand-logo";
import { LanguageSwitcher } from "./language-switcher";
import { QuickSearch } from "./quick-search";
import { contact } from "@/data/contact";
import { collections, productTypes, tx } from "@/data/catalogue";

type Mega = "products" | "collections";
const nav: { to: string; label: string; mega?: Mega }[] = [
  { to: "/", label: "Trang chủ" },
  { to: "/products", label: "Sản phẩm", mega: "products" },
  { to: "/collections", label: "Bộ sưu tập", mega: "collections" },
  { to: "/blog", label: "Nhật ký" },
  { to: "/about", label: "Về BiBi" },
  { to: "/contact", label: "Liên hệ" },
];

function MegaPanel({ kind, onDone }: { kind: Mega; onDone: () => void }) {
  const items =
    kind === "products"
      ? productTypes.map((t) => ({ key: t.id, to: "/products/$slug" as const, slug: t.slug, name: tx(t.plural), sub: tx(t.tagline), image: t.image }))
      : collections.map((c) => ({ key: c.id, to: "/collections/$slug" as const, slug: c.slug, name: tx(c.name), sub: tx(c.tagline), image: c.image }));
  return (
    <div className="absolute inset-x-0 top-full z-50 border-y border-border bg-background shadow-paper animate-in fade-in slide-in-from-top-1 duration-300">
      <div className="mx-auto grid max-w-[1280px] grid-cols-[14rem_1fr] gap-10 px-12 py-10">
        <div>
          <p className="eyebrow">{kind === "products" ? "Loại sản phẩm" : "Bộ sưu tập"}</p>
          <Link to={kind === "products" ? "/products" : "/collections"} onClick={onDone} className="mt-4 flex items-center gap-2 font-display text-2xl hover:text-accent">
            Xem tất cả <ArrowRight className="size-4" />
          </Link>
        </div>
        <ul className="grid grid-cols-4 gap-6">
          {items.map((it) => (
            <li key={it.key}>
              <Link to={it.to} params={{ slug: it.slug }} onClick={onDone} className="group block">
                <div className="overflow-hidden bg-secondary">
                  {it.image ? (
                    <img src={it.image} alt="" loading="lazy" className="aspect-[3/2] w-full object-cover transition duration-700 group-hover:scale-[1.05]" />
                  ) : <div className="aspect-[3/2] paper-texture" />}
                </div>
                <p className="mt-3 font-display text-lg leading-tight">{it.name}</p>
                <p className="mt-0.5 line-clamp-1 text-[12px] text-muted-foreground">{it.sub}</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [mega, setMega] = useState<Mega | null>(null);
  return (
    <header className="relative z-40 w-full border-b border-border bg-background" onMouseLeave={() => setMega(null)}>
      <div className="mx-auto grid max-w-[1280px] grid-cols-[2.75rem_minmax(0,1fr)_5.5rem] items-center gap-2 px-4 py-3 sm:px-6 lg:flex lg:justify-between lg:gap-6 lg:px-12 lg:py-4">
        <button
          className="grid size-11 place-items-center lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Đóng menu" : "Mở menu"}
          aria-expanded={open}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>

        <Link to="/" aria-label="BiBi Studio — Trang chủ" className="min-w-0 justify-self-center">
          <BrandLogo />
        </Link>

        <nav aria-label="Điều hướng chính" className="hidden lg:block">
          <ul className="flex items-center gap-6 xl:gap-8">
            {nav.map((n) => (
              <li key={n.to} onMouseEnter={() => setMega(n.mega ?? null)} onFocus={() => setMega(n.mega ?? null)}>
                <Link
                  to={n.to}
                  onClick={() => setMega(null)}
                  className="py-3 text-[12px] font-medium uppercase tracking-[0.2em] text-foreground/80 transition hover:text-foreground"
                  activeOptions={{ exact: n.to === "/" }}
                  activeProps={{ className: "text-foreground underline underline-offset-8" }}
                >
                  {n.label}
                </Link>
              </li>
            ))}
            <li onMouseEnter={() => setMega(null)}><QuickSearch className="-mx-2" /></li>
            <li onMouseEnter={() => setMega(null)}>
              <LanguageSwitcher variant="header" />
            </li>
          </ul>
        </nav>

        <div className="flex items-center justify-self-end lg:hidden">
          <QuickSearch />
          <a href={`tel:${contact.phone}`} className="grid size-11 place-items-center" aria-label="Gọi BiBi Studio">
            <Phone className="size-5" />
          </a>
        </div>
      </div>

      {mega && <div className="hidden lg:block"><MegaPanel kind={mega} onDone={() => setMega(null)} /></div>}

      {open && (
        <nav aria-label="Menu di động" className="border-t border-border px-4 pb-8 sm:px-6 lg:hidden">
          <ul>
            {nav.map((n) => (
              <li key={n.to}>
                <Link
                  to={n.to}
                  onClick={() => setOpen(false)}
                  className="block border-b border-border py-4 font-display text-2xl"
                >
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-6">
            <LanguageSwitcher variant="drawer" />
          </div>
        </nav>
      )}
    </header>
  );
}
