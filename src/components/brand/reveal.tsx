import { useEffect, useRef, type ReactNode, type ElementType } from "react";

// Gentle scroll reveal via IntersectionObserver (no-op with reduced motion via CSS).
// variant "paper" = a sheet being laid down on the table: lift, slight turn, settle flat.
export function Reveal({
  children,
  as: Tag = "div",
  className = "",
  delay = 0,
  variant = "rise",
}: {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  delay?: number;
  variant?: "rise" | "paper";
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          el.classList.add("is-visible");
          io.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag
      ref={ref}
      className={`${variant === "paper" ? "reveal-paper" : "reveal"} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}
