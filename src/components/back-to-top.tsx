import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";

export function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const on = () => setShow(window.scrollY > 1200);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Lên đầu trang"
      tabIndex={show ? 0 : -1}
      className={`back-to-top fixed bottom-20 right-3 z-40 grid size-11 place-items-center border border-border bg-background/95 shadow-paper backdrop-blur transition duration-500 hover:bg-secondary md:bottom-16 md:right-4 ${show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"}`}
    >
      <ArrowUp className="size-4" />
    </button>
  );
}
