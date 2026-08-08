// src/components/product/product-image-gallery.tsx
import { useState } from "react";

export function ProductImageGallery({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = useState(0);

  return (
    <div>
      <div className="overflow-hidden bg-secondary">
        <img
          src={images[active]}
          alt={name}
          className="aspect-square w-full object-cover"
        />
      </div>
      {images.length > 1 && (
        <div className="mt-4 grid grid-cols-6 gap-2">
          {images.map((img, i) => (
            <button
              key={img}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Ảnh ${i + 1}`}
              className={`overflow-hidden border transition-colors ${
                i === active ? "border-accent" : "border-border hover:border-accent"
              }`}
            >
              <img src={img} alt="" loading="lazy" className="aspect-square w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
