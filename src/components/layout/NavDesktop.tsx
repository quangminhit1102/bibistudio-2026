// src/components/layout/NavDesktop.tsx
// Desktop navigation bar with real TanStack Router links for collection routes.
import { ChevronDown } from "lucide-react";
import { Link } from "@tanstack/react-router";

const shopCollections = [
  { label: "Notebook", slug: "collection-notebook" },
  { label: "Scrapbook & DIY", slug: "scrapbook-diy" },
  { label: "Bút & Phụ kiện", slug: "but-phu-kien" },
  { label: "New Arrival", slug: "new-arrival" },
  { label: "Back to School", slug: "back-to-school" },
] as const;

const ppsItems = ["Paper - Giấy các loại", "Packaging - Giải pháp đóng gói"] as const;

export function NavDesktop() {
  return (
    <ul className="mx-auto hidden max-w-[1200px] items-center justify-center gap-8 px-4 text-[15px] lg:flex">
      <li>
        <Link
          to="/"
          className="block py-4 font-medium hover:text-accent"
          activeProps={{ className: "block py-4 font-medium text-accent" }}
        >
          Home
        </Link>
      </li>

      {/* Shop dropdown with real collection links */}
      <li className="group relative">
        <button className="flex items-center gap-1 py-4 hover:text-accent">
          Shop <ChevronDown className="size-3.5" />
        </button>
        <div className="invisible absolute left-0 top-full z-30 w-56 border border-border bg-background opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100">
          {shopCollections.map((col) => (
            <Link
              key={col.slug}
              to="/collections/$slug"
              params={{ slug: col.slug }}
              className="block px-4 py-2.5 text-sm hover:bg-secondary hover:text-accent"
              activeProps={{ className: "block px-4 py-2.5 text-sm bg-secondary text-accent" }}
            >
              {col.label}
            </Link>
          ))}
        </div>
      </li>

      <li>
        <a
          href="https://www.instagram.com/sthm.stationery/"
          className="block py-4 hover:text-accent"
          target="_blank"
          rel="noopener noreferrer"
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
        <Link
          to="/collections/$slug"
          params={{ slug: "back-to-school" }}
          className="block py-4 hover:text-accent"
          activeProps={{ className: "block py-4 text-accent" }}
        >
          Back to School
        </Link>
      </li>

      {/* PPS dropdown */}
      <li className="group relative">
        <button className="flex items-center gap-1 py-4 hover:text-accent">
          PPS <ChevronDown className="size-3.5" />
        </button>
        <div className="invisible absolute left-0 top-full z-30 w-64 border border-border bg-background opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100">
          {ppsItems.map((item) => (
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
  );
}
