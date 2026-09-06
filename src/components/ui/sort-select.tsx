// src/components/ui/sort-select.tsx
import { PRODUCT_SORT_OPTIONS, type ProductSortKey } from "@/data/pagination";

export function SortSelect({
  value,
  onChange,
}: {
  value: ProductSortKey;
  onChange: (v: ProductSortKey) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
      Sắp xếp theo:
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ProductSortKey)}
        className="border border-border bg-background px-3 py-1.5 text-[13px] text-foreground outline-none focus:border-accent"
      >
        {PRODUCT_SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
