// Product-showcase motion primitives. All effects are transform/opacity only and
// switch off for users who prefer reduced motion.
import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function finePointer() {
  return typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

/** Calls cb with the element's progress through the viewport (0 = just below, 1 = just above). */
function useScrollProgress(ref: React.RefObject<HTMLElement | null>, cb: (p: number) => void) {
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    let raf = 0;
    const tick = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      cb(Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height))));
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(tick); };
    tick();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** Slow vertical drift of an image while scrolling (depth). */
export function Parallax({ children, strength = 80, className = "" }: { children: ReactNode; strength?: number; className?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  useScrollProgress(wrap, (p) => {
    if (inner.current) inner.current.style.transform = `translate3d(0, ${(p - 0.5) * strength}px, 0) scale(1.12)`;
  });
  return (
    <div ref={wrap} className={`overflow-hidden ${className}`}>
      <div ref={inner} className="h-full w-full will-change-transform">{children}</div>
    </div>
  );
}

/** Image frame that opens from a narrow inset to full width as it scrolls into view. */
export function ScrollExpand({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useScrollProgress(ref, (p) => {
    const t = Math.min(1, p / 0.45);
    const e = 1 - Math.pow(1 - t, 3);
    if (ref.current) {
      const x = (1 - e) * 12, y = (1 - e) * 8;
      ref.current.style.clipPath = `inset(${y}% ${x}% ${y}% ${x}%)`;
    }
  });
  return <div ref={ref} className={className} style={{ clipPath: "inset(0)" }}>{children}</div>;
}

/** Splits a line into words that rise one after another. */
export function SplitWords({ text, delay = 0, step = 70, className = "" }: { text: string; delay?: number; step?: number; className?: string }) {
  return (
    <span className={className}>
      {text.split(" ").map((w, i) => (
        <span key={i} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
          <span className="inline-block animate-word" style={{ animationDelay: `${delay + i * step}ms` }}>
            {w}
            {"\u00A0"}
          </span>
        </span>
      ))}
    </span>
  );
}

/** Tilts its child toward the pointer, like holding a card in the hand. */
export function Tilt({ children, max = 6, className = "" }: { children: ReactNode; max?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const enabled = useRef(false);
  useEffect(() => { enabled.current = finePointer() && !prefersReducedMotion(); }, []);
  const move = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || !enabled.current) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateX(${-y * max}deg) rotateY(${x * max}deg) translateY(-4px)`;
    el.style.setProperty("--glare-x", `${(x + 0.5) * 100}%`);
    el.style.setProperty("--glare-y", `${(y + 0.5) * 100}%`);
  };
  const leave = () => { if (ref.current) ref.current.style.transform = ""; };
  return (
    <div ref={ref} onPointerMove={move} onPointerLeave={leave} className={`tilt ${className}`}>
      {children}
    </div>
  );
}

/** Horizontal film strip driven by vertical scroll on large screens; swipeable row on touch. */
export function FilmStrip({ children, header }: { children: ReactNode; header?: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(false);
  const [height, setHeight] = useState<number>();

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const decide = () => setPinned(mq.matches && !prefersReducedMotion());
    decide();
    mq.addEventListener("change", decide);
    return () => mq.removeEventListener("change", decide);
  }, []);

  useEffect(() => {
    if (!pinned) { setHeight(undefined); if (track.current) track.current.style.transform = ""; return; }
    const o = outer.current, t = track.current;
    if (!o || !t) return;
    let dist = 0, raf = 0;
    const measure = () => {
      dist = Math.max(0, t.scrollWidth - window.innerWidth + 96);
      setHeight(window.innerHeight + dist);
    };
    const tick = () => {
      raf = 0;
      const r = o.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -r.top / Math.max(1, dist)));
      t.style.transform = `translate3d(${-p * dist}px,0,0)`;
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(tick); };
    measure(); tick();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", () => { measure(); on(); });
    return () => { cancelAnimationFrame(raf); window.removeEventListener("scroll", on); };
  }, [pinned]);

  const style: CSSProperties | undefined = pinned && height ? { height } : undefined;
  return (
    <div ref={outer} style={style} className="relative">
      <div className={pinned ? "sticky top-0 flex h-screen flex-col justify-center overflow-hidden" : ""}>
        {header}
        <div className={pinned ? "" : "no-scrollbar snap-x snap-mandatory overflow-x-auto"}>
          <div ref={track} className="flex w-max gap-6 px-5 will-change-transform sm:px-6 lg:gap-10 lg:px-12">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Product image with a hover magnifier (desktop) and double-tap zoom (touch). */
export function Magnifier({ src, alt, className = "", style }: { src: string; alt: string; className?: string; style?: CSSProperties }) {
  const [lens, setLens] = useState<{ x: number; y: number } | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [origin, setOrigin] = useState("50% 50%");
  const lastTap = useRef(0);
  const fine = useRef(false);
  useEffect(() => { fine.current = finePointer(); }, []);
  useEffect(() => { setZoomed(false); setLens(null); }, [src]);

  const pos = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
  };
  return (
    <div
      className={`relative cursor-zoom-in overflow-hidden ${className}`}
      style={style}
      onPointerMove={(e) => { if (fine.current && e.pointerType === "mouse") setLens(pos(e)); }}
      onPointerLeave={() => setLens(null)}
      onPointerUp={(e) => {
        if (e.pointerType === "mouse") return;
        const now = Date.now();
        if (now - lastTap.current < 320) {
          const p = pos(e);
          setOrigin(`${p.x}% ${p.y}%`);
          setZoomed((z) => !z);
        }
        lastTap.current = now;
      }}
    >
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-contain transition-transform duration-500 ease-out"
        style={{ transform: zoomed ? "scale(2.2)" : undefined, transformOrigin: origin }}
      />
      {lens && (
        <div
          aria-hidden
          className="pointer-events-none absolute size-44 -translate-x-1/2 -translate-y-1/2 rounded-full border border-background bg-no-repeat shadow-paper"
          style={{
            left: `${lens.x}%`,
            top: `${lens.y}%`,
            backgroundImage: `url("${src}")`,
            backgroundSize: "260%",
            backgroundPosition: `${lens.x}% ${lens.y}%`,
            backgroundColor: "var(--color-secondary)",
          }}
        />
      )}
      <span className="pointer-events-none absolute bottom-3 right-3 bg-background/80 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground backdrop-blur">
        <span className="hidden md:inline">Rê chuột để xem cận</span>
        <span className="md:hidden">{zoomed ? "Chạm 2 lần để thu nhỏ" : "Chạm 2 lần để phóng to"}</span>
      </span>
    </div>
  );
}
