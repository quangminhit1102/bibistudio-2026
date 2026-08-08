// src/components/product/product-options.tsx
type Option = { label: string; values: string[] };

export function ProductOptions({
  options,
  choices,
  onChange,
}: {
  options: Option[];
  choices: Record<string, string>;
  onChange: (label: string, value: string) => void;
}) {
  return (
    <>
      {options.map((opt) => (
        <div key={opt.label} className="mt-5">
          <p className="mb-2 text-[13px] font-semibold text-foreground">{opt.label}</p>
          <div className="flex flex-wrap gap-2">
            {opt.values.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => onChange(opt.label, v)}
                className={`border px-3 py-1.5 text-[13px] transition-colors ${
                  choices[opt.label] === v
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-border text-foreground hover:border-accent"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
