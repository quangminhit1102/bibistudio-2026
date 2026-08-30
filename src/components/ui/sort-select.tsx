// src/components/ui/sort-select.tsx
const sortOptions = [
  { value: "default", label: "Mặc định" },
  { value: "az", label: "A → Z" },
  { value: "za", label: "Z → A" },
  { value: "asc", label: "Giá tăng dần" },
  { value: "desc", label: "Giá giảm dần" },
] as const;

export type SortValue = (typeof sortOptions)[number]["value"];

export function SortSelect({
  value,
  onChange,
}: {
  value: SortValue;
  onChange: (v: SortValue) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
      Sắp xếp theo:
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortValue)}
        className="border border-border bg-background px-3 py-1.5 text-[13px] text-foreground outline-none focus:border-accent"
      >
        {sortOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
