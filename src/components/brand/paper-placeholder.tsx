import { t } from "@/lib/messages";
import { site } from "@/platform/site";

// Branded neutral placeholder used whenever a product/collection image is missing.
export function PaperPlaceholder({
  label,
  ratio = "4/5",
  size,
  className = "",
}: {
  label: string;
  ratio?: string;
  size?: string;
  className?: string;
}) {
  return (
    <div
      className={`paper-texture flex w-full flex-col items-center justify-center gap-2 text-center ${className}`}
      style={{ aspectRatio: ratio }}
      role="img"
      aria-label={t("placeholder.label", { label })}
    >
      <span className="font-display text-sm italic text-kraft">{site.name}</span>
      <span className="text-[11px] font-medium uppercase tracking-[0.3em] text-foreground/70">
        {label}
      </span>
      <span className="text-[11px] text-muted-foreground">{t("placeholder.text")}</span>
      {size && <span className="text-[10px] tracking-wider text-muted-foreground/70">{size}</span>}
    </div>
  );
}
