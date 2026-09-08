export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <g stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        {/* left stem */}
        <path d="M14 4v64" />
        {/* upper bowl */}
        <path d="M14 4h14a16 16 0 0 1 0 32H14" />
        {/* lower bowl */}
        <path d="M14 36h16a16 16 0 0 1 0 32H14" />
        {/* beak / wing gesture */}
        <path d="M31 36 20 50" />
      </g>
      <circle cx="30" cy="20" r="3" fill="currentColor" />
    </svg>
  );
}

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-3 text-foreground">
      <BrandMark className="h-11 w-auto" />
      <span className="flex flex-col items-center text-center leading-none">
        <span className="text-[22px] font-medium tracking-tight">BiBi Studio</span>
        {!compact && (
          <span className="mt-1 text-[9px] font-light uppercase tracking-[0.28em] text-muted-foreground pl-[0.28em]">
            Touch your heart
          </span>
        )}
      </span>
    </span>
  );
}
