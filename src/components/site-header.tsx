// src/components/site-header.tsx
// Composing header from focused sub-components.
// Each sub-component has a single responsibility for maintainability.
import { Menu, Search, ShoppingCart, User } from "lucide-react";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { BrandLogo } from "./brand-logo";
import { UtilityBar } from "./layout/UtilityBar";
import { NavDesktop } from "./layout/NavDesktop";
import { NavMobile } from "./layout/NavMobile";

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      {/* Top utility bar: phone, email, order tracking */}
      <UtilityBar />

      {/* Main bar: hamburger, search, logo, account, cart */}
      <div className="border-b border-border">
        <div className="mx-auto grid max-w-[1200px] grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-4 lg:grid-cols-3">
          <button
            className="lg:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Mở menu"
            aria-expanded={mobileOpen}
          >
            <Menu className="size-6 text-primary" />
          </button>

          <form
            className="hidden items-center rounded-sm border border-border lg:flex"
            onSubmit={(e) => e.preventDefault()}
          >
            <input
              type="search"
              placeholder="Tìm kiếm sản phẩm ..."
              className="w-full bg-transparent px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
            />
            <button type="submit" className="px-4 text-primary" aria-label="Tìm kiếm">
              <Search className="size-4" />
            </button>
          </form>

          <Link to="/" className="justify-self-center" aria-label="BiBi Studio — Trang chủ">
            <BrandLogo />
          </Link>

          <div className="flex items-center justify-end gap-5">
            <a href="#" className="flex items-center gap-2 text-sm hover:text-accent">
              <span className="flex size-7 items-center justify-center rounded-full bg-accent/15 text-accent">
                <User className="size-4" />
              </span>
              <span className="hidden md:inline">Tài khoản</span>
            </a>
            <a
              href="#"
              className="relative flex items-center gap-2 text-sm hover:text-accent"
              aria-label="Giỏ hàng (0 sản phẩm)"
            >
              <span className="flex size-7 items-center justify-center rounded-full bg-accent/15 text-accent">
                <ShoppingCart className="size-4" />
              </span>
              <span className="absolute -top-1 left-4 flex size-4 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-accent-foreground">
                0
              </span>
            </a>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav aria-label="Điều hướng chính">
        <NavDesktop />
        {mobileOpen && <NavMobile onClose={() => setMobileOpen(false)} />}
      </nav>
    </header>
  );
}
