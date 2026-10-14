import { Link } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getAllProducts, getProductType, tx } from "@/data/catalogue";

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toLowerCase();

/** Search icon that opens a full-screen overlay listing matching products with thumbnails. */
export function QuickSearch({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = prev; };
  }, [open]);

  const results = useMemo(() => {
    const n = norm(q.trim());
    if (!n) return [];
    return getAllProducts().filter((p) => norm(`${p.name.vi} ${p.name.en} ${tx(getProductType(p.productType).name)}`).includes(n)).slice(0, 12);
  }, [q]);

  const close = () => { setOpen(false); setQ(""); };

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Tìm sản phẩm" className={`grid size-11 place-items-center transition hover:text-accent ${className}`}>
        <Search className="size-[18px]" />
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label="Tìm sản phẩm" className="fixed inset-0 z-[70] overflow-y-auto bg-background animate-in fade-in duration-300">
          <div className="mx-auto max-w-[1080px] px-5 py-6 sm:px-6 md:py-12">
            <div className="flex items-center gap-4 border-b border-foreground pb-3">
              <Search className="size-5 shrink-0 text-muted-foreground" />
              <input
                ref={input}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tìm sổ tay, thiệp, magnet…"
                className="min-w-0 flex-1 bg-transparent font-display text-3xl outline-none placeholder:text-muted-foreground/60 md:text-5xl"
                aria-label="Từ khóa"
              />
              <button onClick={close} aria-label="Đóng tìm kiếm" className="grid size-11 shrink-0 place-items-center"><X className="size-5" /></button>
            </div>
            {q.trim() && (
              <p className="eyebrow mt-6">{results.length ? `${results.length} kết quả` : "Không tìm thấy mẫu nào — thử từ khóa khác nhé."}</p>
            )}
            <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4">
              {results.map((p, i) => (
                <li key={p.slug} className="animate-in fade-in slide-in-from-bottom-2 duration-500" style={{ animationDelay: `${i * 40}ms`, animationFillMode: "both" }}>
                  <Link to="/products/$slug" params={{ slug: p.slug }} onClick={close} className="group block">
                    <div className="overflow-hidden bg-secondary">
                      {p.images[0] ? (
                        <img src={p.images[0]} alt="" className="aspect-square w-full object-contain transition duration-700 group-hover:scale-[1.05]" />
                      ) : <div className="aspect-square w-full paper-texture" />}
                    </div>
                    <p className="eyebrow mt-3">{tx(getProductType(p.productType).name)}</p>
                    <p className="mt-1 font-display text-lg leading-tight">{tx(p.name)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
