import { Link } from "@tanstack/react-router";
import { ChevronDown, Menu, Phone, Search, ShoppingCart, User, ClipboardList, Mail } from "lucide-react";
import { useState } from "react";

const LOGO = "https://bizweb.dktcdn.net/100/343/063/themes/792164/assets/logo.png";

const shopMenu = [
  {
    label: "Notebook",
    items: [
      "The Original & Classic Notebook",
      "The SIMPERIE",
      "Sketchbook",
      "Collection Notebook",
      "Customized Notebook & More",
      "Scrapbook & DIY",
    ],
  },
  { label: "The SIMPERIE", items: [] },
  { label: "Scrapbook & DIY", items: ["Shop All"] },
  { label: "Gift Sets", items: ["Combo Sketchbook", "Combo Scrapbooking & DIY"] },
  {
    label: "PPS - Paper and Packaging Solution",
    items: ["Paper - Giấy các loại", "Packaging - Giải pháp đóng gói"],
  },
  { label: "Writing tools", items: ["Pens & Pencils", "Journaling Supplies"] },
];

const ppsMenu = ["Paper - Giấy các loại", "Packaging - Giải pháp đóng gói"];

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="w-full bg-background">
      {/* Utility bar */}
      <div className="border-b border-border">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-4 py-2 text-sm">
          <div className="flex items-center gap-6">
            <a href="tel:0967495867" className="flex items-center gap-2 hover:text-accent">
              <span className="flex size-6 items-center justify-center rounded-full bg-sage/60 text-primary">
                <Phone className="size-3.5" />
              </span>
              0967495867
            </a>
            <a
              href="mailto:sthm.vn@gmail.com"
              className="hidden items-center gap-2 hover:text-accent sm:flex"
            >
              <span className="flex size-6 items-center justify-center rounded-full bg-sage/60 text-primary">
                <Mail className="size-3.5" />
              </span>
              sthm.vn@gmail.com
            </a>
          </div>
          <a href="#" className="flex items-center gap-2 hover:text-accent">
            <span className="flex size-6 items-center justify-center rounded-full bg-accent/15 text-accent">
              <ClipboardList className="size-3.5" />
            </span>
            <span className="hidden sm:inline">Kiểm tra đơn hàng</span>
          </a>
        </div>
      </div>

      {/* Main bar */}
      <div className="border-b border-border">
        <div className="mx-auto grid max-w-[1200px] grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-4 lg:grid-cols-3">
          <button
            className="lg:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Mở menu"
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

          <Link to="/" className="justify-self-center">
            <img src={LOGO} alt="STHM Stationery" className="h-12 w-auto" />
          </Link>

          <div className="flex items-center justify-end gap-5">
            <a href="#" className="flex items-center gap-2 text-sm hover:text-accent">
              <span className="flex size-7 items-center justify-center rounded-full bg-accent/15 text-accent">
                <User className="size-4" />
              </span>
              <span className="hidden md:inline">Tài khoản</span>
            </a>
            <a href="#" className="relative flex items-center gap-2 text-sm hover:text-accent">
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

      {/* Nav */}
      <nav className="border-b border-border">
        <ul className="mx-auto hidden max-w-[1200px] items-center justify-center gap-8 px-4 text-[15px] lg:flex">
          <li>
            <Link
              to="/"
              className="block py-4 font-medium text-accent"
              activeProps={{ className: "block py-4 font-medium text-accent" }}
            >
              Home
            </Link>
          </li>
          <li className="group relative">
            <button className="flex items-center gap-1 py-4 hover:text-accent">
              Shop <ChevronDown className="size-3.5" />
            </button>
            <div className="invisible absolute left-0 top-full z-30 w-64 border border-border bg-background opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100">
              {shopMenu.map((group) => (
                <div key={group.label} className="group/sub relative">
                  <a
                    href="#"
                    className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-secondary hover:text-accent"
                  >
                    {group.label}
                    {group.items.length > 0 && <ChevronDown className="size-3 -rotate-90" />}
                  </a>
                  {group.items.length > 0 && (
                    <div className="invisible absolute left-full top-0 w-64 border border-border bg-background opacity-0 shadow-lg transition group-hover/sub:visible group-hover/sub:opacity-100">
                      {group.items.map((item) => (
                        <a
                          key={item}
                          href="#"
                          className="block px-4 py-2.5 text-sm hover:bg-secondary hover:text-accent"
                        >
                          {item}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </li>
          <li>
            <a
              href="https://www.instagram.com/sthm.stationery/"
              className="block py-4 hover:text-accent"
            >
              The World of STHM
            </a>
          </li>
          <li>
            <a href="#" className="block py-4 hover:text-accent">
              Personalized Notebook &amp; More
            </a>
          </li>
          <li>
            <a href="#" className="block py-4 hover:text-accent">
              Back to School
            </a>
          </li>
          <li className="group relative">
            <button className="flex items-center gap-1 py-4 hover:text-accent">
              PPS - Paper and Packaging Solution <ChevronDown className="size-3.5" />
            </button>
            <div className="invisible absolute left-0 top-full z-30 w-64 border border-border bg-background opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100">
              {ppsMenu.map((item) => (
                <a
                  key={item}
                  href="#"
                  className="block px-4 py-2.5 text-sm hover:bg-secondary hover:text-accent"
                >
                  {item}
                </a>
              ))}
            </div>
          </li>
        </ul>

        {mobileOpen && (
          <ul className="mx-auto max-w-[1200px] px-4 pb-4 lg:hidden">
            {["Home", "Shop", "The World of STHM", "Personalized Notebook & More", "Back to School", "PPS - Paper and Packaging Solution"].map(
              (item) => (
                <li key={item}>
                  <a href="#" className="block border-b border-border py-3 text-sm">
                    {item}
                  </a>
                </li>
              ),
            )}
          </ul>
        )}
      </nav>
    </header>
  );
}
