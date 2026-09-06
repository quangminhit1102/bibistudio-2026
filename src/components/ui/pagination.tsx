// src/components/ui/pagination.tsx
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

type PaginationProps = {
  to: string;
  page: number;
  totalPages: number;
  search: (targetPage: number) => Record<string, unknown>;
};

function pageItems(page: number, totalPages: number): (number | "...")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const wanted = new Set([1, 2, totalPages - 1, totalPages, page - 1, page, page + 1]);
  const sorted = [...wanted].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const items: (number | "...")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) items.push("...");
    items.push(p);
    prev = p;
  }
  return items;
}

const itemClass =
  "inline-flex h-9 min-w-9 items-center justify-center border border-border px-3 text-[13px]";
const idleClass = "text-foreground transition hover:border-accent hover:text-accent";
const activeClass = "border-accent bg-accent text-white";
const disabledClass = "cursor-not-allowed text-muted-foreground/40";

export function Pagination({ to, page, totalPages, search }: PaginationProps) {
  if (totalPages <= 1) return null;

  const link = (n: number, children: ReactNode, extraClass = "") => (
    <Link
      key={n}
      to={to}
      search={search(n)}
      aria-label={`Trang ${n}`}
      className={`${itemClass} ${n === page ? activeClass : idleClass} ${extraClass}`}
      aria-current={n === page ? "page" : undefined}
    >
      {children}
    </Link>
  );

  return (
    <nav aria-label="Phân trang" className="mt-10 flex items-center justify-center gap-1.5">
      {page > 1 ? (
        link(page - 1, <ChevronLeft className="h-4 w-4" aria-hidden />)
      ) : (
        <span aria-disabled="true" className={`${itemClass} ${disabledClass}`}>
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </span>
      )}

      {pageItems(page, totalPages).map((item, i) =>
        item === "..." ? (
          <span key={`gap-${i}`} className={`${itemClass} border-transparent`}>
            …
          </span>
        ) : (
          link(item, item)
        ),
      )}

      {page < totalPages ? (
        link(page + 1, <ChevronRight className="h-4 w-4" aria-hidden />)
      ) : (
        <span aria-disabled="true" className={`${itemClass} ${disabledClass}`}>
          <ChevronRight className="h-4 w-4" aria-hidden />
        </span>
      )}
    </nav>
  );
}
