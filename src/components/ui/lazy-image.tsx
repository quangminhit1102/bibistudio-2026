// src/components/ui/lazy-image.tsx
import { useEffect, useRef, useState } from "react";

type LazyImageProps = {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean; // If true, eager-loads and increases priority (for LCP images)
  aspectRatio?: "square" | "auto";
};

export function LazyImage({
  src,
  alt,
  className = "",
  priority = false,
  aspectRatio = "auto",
}: LazyImageProps) {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // If the image finished loading before React hydrated, the load event
  // has already fired — show it immediately instead of staying faded out.
  useEffect(() => {
    if (imgRef.current?.complete) setLoaded(true);
  }, []);

  return (
    <div
      className={`relative overflow-hidden ${
        aspectRatio === "square" ? "aspect-square" : ""
      } bg-secondary`}
    >
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-secondary/80" aria-hidden="true" />
      )}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={`w-full object-cover transition-opacity duration-300 ${
          loaded ? "opacity-100" : "opacity-0"
        } ${className}`}
      />
    </div>
  );
}
