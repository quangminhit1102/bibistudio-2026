// src/components/ui/quantity-input.tsx
import { Minus, Plus } from "lucide-react";

export function QuantityInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center border border-border">
      <button
        type="button"
        aria-label="Giảm số lượng"
        onClick={() => onChange(Math.max(1, value - 1))}
        className="flex size-10 items-center justify-center text-foreground hover:bg-secondary transition-colors"
      >
        <Minus className="size-4" />
      </button>
      <span className="w-12 text-center text-[14px] font-semibold">{value}</span>
      <button
        type="button"
        aria-label="Tăng số lượng"
        onClick={() => onChange(value + 1)}
        className="flex size-10 items-center justify-center text-foreground hover:bg-secondary transition-colors"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
