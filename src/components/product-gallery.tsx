import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { Magnifier } from "@/components/brand/motion";

/** Product gallery: magnifier + thumbnails on desktop, swipe row + dots on phones, fullscreen viewer on both. */
export function ProductGallery({ images, alt, transitionName }: { images: string[]; alt: string; transitionName: string }) {
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const row = useRef<HTMLDivElement>(null);

  const onRowScroll = () => {
    const el = row.current;
    if (el) setActive(Math.round(el.scrollLeft / el.clientWidth));
  };

  return (
    <div>
      {/* Desktop */}
      <div className="relative hidden md:block">
        <Magnifier
          src={images[active]}
          alt={alt}
          className="aspect-[4/5] w-full bg-secondary"
          style={active === 0 ? { viewTransitionName: transitionName } : undefined}
        />
        <button
          onClick={() => setOpen(true)}
          aria-label="Xem toàn màn hình"
          className="absolute right-3 top-3 grid size-10 place-items-center bg-background/85 text-foreground backdrop-blur transition hover:bg-background"
        >
          <Expand className="size-4" />
        </button>
      </div>

      {/* Phone: swipe row */}
      <div className="relative md:hidden">
        <div ref={row} onScroll={onRowScroll} className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto">
          {images.map((src, i) => (
            <button key={src} onClick={() => { setActive(i); setOpen(true); }} className="w-full shrink-0 snap-center" aria-label={`Xem ảnh ${i + 1} toàn màn hình`}>
              <img
                src={src}
                alt={i === 0 ? alt : ""}
                loading={i === 0 ? "eager" : "lazy"}
                style={i === 0 ? { viewTransitionName: transitionName } : undefined}
                className="aspect-[4/5] w-full bg-secondary object-contain"
              />
            </button>
          ))}
        </div>
        {images.length > 1 && (
          <div className="mt-4 flex justify-center gap-2" aria-hidden>
            {images.map((src, i) => (
              <span key={src} className={`h-1.5 rounded-full transition-all duration-500 ${i === active ? "w-6 bg-foreground" : "w-1.5 bg-border"}`} />
            ))}
          </div>
        )}
        <span className="pointer-events-none absolute right-3 top-3 bg-background/85 px-2.5 py-1 text-[11px] tabular-nums text-muted-foreground">
          {active + 1} / {images.length}
        </span>
      </div>

      {/* Desktop thumbnails */}
      {images.length > 1 && (
        <div className="mt-4 hidden grid-cols-5 gap-3 md:grid">
          {images.map((src, i) => (
            <button
              key={src}
              onClick={() => setActive(i)}
              aria-label={`Ảnh ${i + 1}`}
              aria-current={i === active}
              className={`relative overflow-hidden transition ${i === active ? "opacity-100" : "opacity-55 hover:opacity-100"}`}
            >
              <img src={src} alt="" className="aspect-square w-full object-cover" />
              <span className={`absolute inset-x-0 bottom-0 h-0.5 bg-foreground transition-transform duration-500 ${i === active ? "scale-x-100" : "scale-x-0"}`} />
            </button>
          ))}
        </div>
      )}

      {open && <Lightbox images={images} alt={alt} start={active} onClose={(i) => { setActive(i); setOpen(false); }} />}
    </div>
  );
}

function Lightbox({ images, alt, start, onClose }: { images: string[]; alt: string; start: number; onClose: (i: number) => void }) {
  const [i, setI] = useState(start);
  const n = images.length;
  const go = useCallback((d: number) => setI((v) => (v + d + n) % n), [n]);
  const startX = useRef<number | null>(null);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose(i);
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    document.addEventListener("keydown", key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = prev; };
  }, [i, go, onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Xem ảnh sản phẩm"
      className="fixed inset-0 z-[60] flex flex-col bg-background animate-in fade-in duration-300"
      onPointerDown={(e) => { startX.current = e.clientX; }}
      onPointerUp={(e) => {
        if (startX.current === null || e.pointerType === "mouse") return;
        const dx = e.clientX - startX.current;
        if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1);
        startX.current = null;
      }}
    >
      <div className="flex items-center justify-between px-4 py-3 sm:px-6">
        <span className="text-[12px] tabular-nums tracking-[0.2em] text-muted-foreground">{i + 1} / {n}</span>
        <button onClick={() => onClose(i)} aria-label="Đóng" className="grid size-11 place-items-center"><X className="size-5" /></button>
      </div>
      <div className="relative min-h-0 flex-1 px-2 pb-4 sm:px-16">
        <Magnifier key={images[i]} src={images[i]} alt={alt} className="h-full w-full animate-in fade-in zoom-in-95 duration-500" />
        {n > 1 && (
          <>
            <NavBtn side="left" onClick={() => go(-1)}><ChevronLeft className="size-5" /></NavBtn>
            <NavBtn side="right" onClick={() => go(1)}><ChevronRight className="size-5" /></NavBtn>
          </>
        )}
      </div>
      {n > 1 && (
        <div className="no-scrollbar flex justify-center gap-2 overflow-x-auto px-4 pb-5">
          {images.map((src, k) => (
            <button key={src} onClick={() => setI(k)} aria-label={`Ảnh ${k + 1}`} className={`size-14 shrink-0 overflow-hidden transition ${k === i ? "ring-1 ring-foreground" : "opacity-50"}`}>
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NavBtn({ side, onClick, children }: { side: "left" | "right"; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={side === "left" ? "Ảnh trước" : "Ảnh sau"}
      className={`absolute top-1/2 hidden size-12 -translate-y-1/2 place-items-center border border-border bg-background/90 transition hover:bg-secondary sm:grid ${side === "left" ? "left-3" : "right-3"}`}
    >
      {children}
    </button>
  );
}

/** Horizontal slider with arrow buttons. */
export function Slider({ children, label }: { children: ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const by = (d: number) => ref.current?.scrollBy({ left: d * ref.current.clientWidth * 0.8, behavior: "smooth" });
  return (
    <div>
      <div className="mb-8 flex items-end justify-between gap-4 border-b border-border pb-6">
        <h2 className="eyebrow text-foreground">{label}</h2>
        <div className="flex gap-2">
          <button onClick={() => by(-1)} aria-label="Trước" className="grid size-10 place-items-center border border-border transition hover:bg-secondary"><ChevronLeft className="size-4" /></button>
          <button onClick={() => by(1)} aria-label="Sau" className="grid size-10 place-items-center border border-border transition hover:bg-secondary"><ChevronRight className="size-4" /></button>
        </div>
      </div>
      <div ref={ref} className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-2 md:mx-0 md:gap-8 md:px-0">
        {children}
      </div>
    </div>
  );
}
