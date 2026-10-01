// Brand-catalogue header: logo · Products · Collections · About · Contact · language.
import { Menu, Phone, X } from "lucide-react";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { BrandLogo } from "./brand-logo";
import { LanguageSwitcher } from "./language-switcher";
import { contact } from "@/data/contact";

const nav = [
  { to: "/products", label: "Sản phẩm" },
  { to: "/collections", label: "Bộ sưu tập" },
  { to: "/about", label: "Về BiBi" },
  { to: "/contact", label: "Liên hệ" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="relative z-40 w-full border-b border-border bg-background">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-6 px-6 py-4 lg:px-12">
        <button
          className="lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Đóng menu" : "Mở menu"}
          aria-expanded={open}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>

        <Link to="/" aria-label="BiBi Studio — Trang chủ">
          <BrandLogo />
        </Link>

        <nav aria-label="Điều hướng chính" className="hidden lg:block">
          <ul className="flex items-center gap-10">
            {nav.map((n) => (
              <li key={n.to}>
                <Link
                  to={n.to}
                  className="text-[12px] font-medium uppercase tracking-[0.2em] text-foreground/80 transition hover:text-foreground"
                  activeProps={{ className: "text-foreground underline underline-offset-8" }}
                >
                  {n.label}
                </Link>
              </li>
            ))}
            <li>
              <LanguageSwitcher variant="header" />
            </li>
          </ul>
        </nav>

        <a href={`tel:${contact.phone}`} className="lg:hidden" aria-label="Gọi BiBi Studio">
          <Phone className="size-5" />
        </a>
      </div>

      {open && (
        <nav aria-label="Menu di động" className="border-t border-border px-6 pb-8 lg:hidden">
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
            <li>
              <Link to="/blog" onClick={() => setOpen(false)} className="block border-b border-border py-4 font-display text-2xl text-muted-foreground">
                Nhật ký
              </Link>
            </li>
          </ul>
          <div className="mt-6">
            <LanguageSwitcher variant="drawer" />
          </div>
        </nav>
      )}
    </header>
  );
}
