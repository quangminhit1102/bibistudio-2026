import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { LazyImage } from "./ui/lazy-image";

const slides = [
  {
    img: "https://bizweb.dktcdn.net/100/343/063/themes/792164/assets/slider_1.jpg",
    alt: "Back to School",
  },
  {
    img: "https://bizweb.dktcdn.net/100/343/063/themes/792164/assets/slider_2.jpg",
    alt: "Tập B5 gáy còng nhựa",
  },
  {
    img: "https://bizweb.dktcdn.net/100/343/063/themes/792164/assets/slider_3.jpg",
    alt: "Notebook wrapping paper",
  },
  {
    img: "https://bizweb.dktcdn.net/100/343/063/themes/792164/assets/slider_4.jpg",
    alt: "STHM Stationery",
  },
  {
    img: "https://bizweb.dktcdn.net/100/343/063/themes/792164/assets/slider_5.jpg",
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

      <div className="absolute left-4 top-1/2 flex -translate-y-1/2 flex-col gap-2.5 md:left-6">
        {slides.map((s, i) => (
          <button
            key={s.img}
            onClick={() => go(i)}
            aria-label={`Slide ${i + 1}`}
            className={`size-2 rounded-full transition ${
              i === index ? "bg-accent" : "bg-primary/25"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
