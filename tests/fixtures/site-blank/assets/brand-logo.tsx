export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect
        x="6"
        y="6"
        width="52"
        height="52"
        rx="8"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
      />
    </svg>
  );
}

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5 text-foreground">
      <BrandMark className="h-9 w-auto shrink-0" />
      {!compact && <span className="whitespace-nowrap text-lg font-medium">Northwind Studio</span>}
    </span>
  );
}
