// src/components/ui/lazy-image.tsx
import { useState } from "react";

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
  aspectRatio = "square",
}: LazyImageProps) {
  const [loaded, setLoaded] = useState(false);

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
