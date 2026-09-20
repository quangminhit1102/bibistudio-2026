import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { LazyImage } from "./ui/lazy-image";

const slides = [
  {
    img: "https://placehold.co/1200x500?text=1200x500",
    alt: "Back to School",
  },
  {
    img: "https://placehold.co/1200x500?text=1200x500",
    alt: "Tập B5 gáy còng nhựa",
  },
  {
    img: "https://placehold.co/1200x500?text=1200x500",
    alt: "Notebook wrapping paper",
  },
  {
    img: "https://placehold.co/1200x500?text=1200x500",
    alt: "BiBi Stationery",
  },
  {
    img: "https://placehold.co/1200x500?text=1200x500",
    alt: "Máy chỉ dán keo",
  },
];

export function HeroSlider() {
  const [index, setIndex] = useState(2);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const go = useCallback((next: number) => {
    setIndex(((next % slides.length) + slides.length) % slides.length);
  }, []);

  useEffect(() => {
    timer.current = setInterval(() => setIndex((i) => (i + 1) % slides.length), 6000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  return (
    <section className="relative overflow-hidden bg-sand" aria-label="Khuyến mãi nổi bật">
      <div
        className="flex transition-transform duration-700 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {slides.map((s, i) => (
          <div key={s.img} className="w-full shrink-0">
            <LazyImage
              src={s.img}
              alt={s.alt}
              priority={i === 2}
              aspectRatio="auto"
              className="w-full object-cover"
            />
          </div>
        ))}
      </div>

      <button
        onClick={() => go(index - 1)}
        aria-label="Slide trước"
        className="absolute left-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-background/70 p-2 text-primary transition hover:bg-background md:block"
      >
        <ChevronLeft className="size-5" />
      </button>
      <button
        onClick={() => go(index + 1)}
        aria-label="Slide sau"
        className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-background/70 p-2 text-primary transition hover:bg-background md:block"
      >
        <ChevronRight className="size-5" />
      </button>

      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 z-10 md:bottom-5 md:gap-2.5">
        {slides.map((s, i) => (
          <button
            key={s.img}
            onClick={() => go(i)}
            aria-label={`Slide ${i + 1}`}
            className={`h-2 rounded-full transition-all duration-300 ${i === index ? "w-6 bg-accent" : "w-2 bg-primary/30 hover:bg-primary/50"
              }`}
          />
        ))}
      </div>
    </section>
  );
}
