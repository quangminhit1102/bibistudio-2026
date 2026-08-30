// src/components/layout/NavMobile.tsx
// Mobile navigation drawer — shown when hamburger is tapped.
// Uses real TanStack Router <Link> components instead of placeholder anchors.
import { Link } from "@tanstack/react-router";

const mobileLinks = [
  { label: "Trang chủ", type: "home" as const },
  { label: "Notebook", type: "collection" as const, slug: "collection-notebook" },
  { label: "Scrapbook & DIY", type: "collection" as const, slug: "scrapbook-diy" },
  { label: "Bút & Phụ kiện", type: "collection" as const, slug: "but-phu-kien" },
  { label: "New Arrival", type: "collection" as const, slug: "new-arrival" },
  { label: "Back to School", type: "collection" as const, slug: "back-to-school" },
  {
    label: "The World of STHM",
    type: "external" as const,
    href: "https://www.instagram.com/sthm.stationery/",
  },
];

export function NavMobile({ onClose }: { onClose: () => void }) {
  return (
    <ul className="mx-auto max-w-[1200px] px-4 pb-4 lg:hidden">
      {mobileLinks.map((item) => (
        <li key={item.label}>
          {item.type === "home" && (
            <Link
              to="/"
              onClick={onClose}
              className="block border-b border-border py-3 text-sm hover:text-accent"
            >
              {item.label}
            </Link>
          )}
          {item.type === "collection" && (
            <Link
              to="/collections/$slug"
              params={{ slug: item.slug }}
              onClick={onClose}
              className="block border-b border-border py-3 text-sm hover:text-accent"
              activeProps={{ className: "block border-b border-border py-3 text-sm text-accent" }}
            >
              {item.label}
            </Link>
          )}
          {item.type === "external" && (
            <a
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="block border-b border-border py-3 text-sm hover:text-accent"
            >
              {item.label}
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
