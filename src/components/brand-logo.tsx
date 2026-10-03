export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <img src="/bibi-mark.svg" alt="" className={className} aria-hidden="true" />
  );
}

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex min-w-0 items-center text-foreground">
      {compact ? (
        <BrandMark className="size-10 shrink-0" />
      ) : (
        <img src="/bibi-logo.svg" alt="bibistudio.vn — touch your heart" className="h-auto w-[190px] sm:w-[220px]" />
      )}
    </span>
  );
}
