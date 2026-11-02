import { useEffect, useState } from "react";
import { Parallax, prefersReducedMotion } from "./motion";
export type HeroSlide = { src: string; alt: string; label?: string; slug?: string };
export function HeroSlides({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (prefersReducedMotion() || slides.length < 2) return;
    const timer = setInterval(() => setIndex((value) => (value + 1) % slides.length), 5500);
    return () => clearInterval(timer);
  }, [slides.length]);
  return (
    <div className="relative min-h-[50vh]">
      <div className="absolute inset-0 overflow-hidden">
        <Parallax strength={90} className="relative h-full w-full">
          <div className="absolute inset-0 animate-unveil">
            {slides.map((slide, k) => (
              <img
                key={slide.src}
                src={slide.src}
                alt={k === index ? slide.alt : ""}
                aria-hidden={k !== index}
                loading={k === 0 ? "eager" : "lazy"}
                className={`absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-[1800ms] ease-out motion-reduce:transition-none ${k === index ? "scale-100 opacity-100" : "scale-[1.05] opacity-0"}`}
              />
            ))}
          </div>
        </Parallax>
      </div>
      <div
        role="group"
        aria-label="Chọn ảnh"
        className="absolute inset-x-0 bottom-5 z-10 flex justify-center gap-1 sm:bottom-6"
      >
        {slides.map((slide, k) => (
          <button
            key={slide.src}
            type="button"
            aria-label={`Ảnh ${k + 1}`}
            aria-current={index === k ? "true" : undefined}
            onClick={() => setIndex(k)}
            className="group grid size-11 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <span
              className={`block size-2.5 rounded-full border border-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)] transition-[background-color,transform] duration-200 group-hover:scale-110 motion-reduce:transition-none ${index === k ? "bg-white" : "bg-black/20"}`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
