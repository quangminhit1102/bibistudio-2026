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
    <span className="flex min-w-0 items-center gap-2.5 text-foreground sm:gap-3">
      <BrandMark className="h-10 w-auto shrink-0 sm:h-11" />
      <span className="flex flex-col items-center text-center leading-none">
        <span className="whitespace-nowrap text-[19px] font-medium sm:text-[22px]">BiBi Studio</span>
        {!compact && (
          <span className="mt-1 whitespace-nowrap pl-[0.28em] text-[8px] font-light uppercase tracking-[0.28em] text-muted-foreground sm:text-[9px]">
            Made with heart
          </span>
        )}
      </span>
    </span>
  );
}
