// Brand-catalogue header: home · products · collections · journal · about · contact · language.
import { Menu, Phone, X } from "lucide-react";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { BrandLogo } from "./brand-logo";
import { LanguageSwitcher } from "./language-switcher";
import { contact } from "@/data/contact";

const nav = [
  { to: "/", label: "Trang chủ" },
  { to: "/products", label: "Sản phẩm" },
  { to: "/collections", label: "Bộ sưu tập" },
  { to: "/blog", label: "Nhật ký" },
  { to: "/about", label: "Về BiBi" },
  { to: "/contact", label: "Liên hệ" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="relative z-40 w-full border-b border-border bg-background">
      <div className="mx-auto grid max-w-[1280px] grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2 px-4 py-3 sm:px-6 lg:flex lg:justify-between lg:gap-6 lg:px-12 lg:py-4">
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
          <ul className="flex items-center gap-7 xl:gap-9">
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

        <a href={`tel:${contact.phone}`} className="grid size-11 place-items-center justify-self-end lg:hidden" aria-label="Gọi BiBi Studio">
          <Phone className="size-5" />
        </a>
      </div>

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
