// src/components/language-switcher.tsx
// Simple language selector dropdown with flag icons. Vietnamese is active; English is shown as "coming soon".
import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

export type Language = "vi" | "en";

interface LanguageSwitcherProps {
  variant?: "header" | "drawer";
}

function VietnamFlag({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 40" className={className} aria-hidden="true">
      <rect width="60" height="40" fill="#DA251D" />
      <polygon
        points="30,8 33.2,18.4 44,18.4 35.4,25.2 38.6,35.6 30,28.8 21.4,35.6 24.6,25.2 16,18.4 26.8,18.4"
        fill="#FFCD00"
      />
    </svg>
  );
}

function UkFlag({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 40" className={className} aria-hidden="true">
      <rect width="60" height="40" fill="#012169" />
      <path
        d="M0 0 L60 40 M60 0 L0 40"
        stroke="white"
        strokeWidth="8"
        fill="none"
      />
      <path
        d="M0 0 L60 40 M60 0 L0 40"
        stroke="#C8102E"
        strokeWidth="5"
        fill="none"
      />
      <path d="M30 0 V40 M0 20 H60" stroke="white" strokeWidth="13" fill="none" />
      <path d="M30 0 V40 M0 20 H60" stroke="#C8102E" strokeWidth="8" fill="none" />
    </svg>
  );
}

const languages = [
  { code: "vi" as Language, label: "Tiếng Việt", short: "VN", Flag: VietnamFlag },
  { code: "en" as Language, label: "English", short: "EN", soon: true, Flag: UkFlag },
];

export function LanguageSwitcher({ variant = "header" }: LanguageSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [lang] = useState<Language>("vi");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [open]);

  const active = languages.find((l) => l.code === lang) ?? languages[0];
  const ActiveFlag = active.Flag;

  // Drawer: simple vertical list without a popup
  if (variant === "drawer") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between text-muted-foreground px-2">
          <span className="text-xs font-bold uppercase tracking-[0.2em]">
            Ngôn ngữ / Language
          </span>
          <div className="ml-4 h-px flex-1 bg-border" />
        </div>

        <div className="flex flex-col gap-1 px-2">
          {languages.map((l) => {
            const isActive = l.code === lang;
            const Flag = l.Flag;
            return (
              <div
                key={l.code}
                className={`flex items-center justify-between rounded-md px-3 py-2.5 ${
                  isActive ? "bg-secondary text-foreground" : "text-muted-foreground opacity-60"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Flag className="size-5 shrink-0 rounded-sm shadow-sm" />
                  {isActive && <Check className="size-4" />}
                  <span className="text-sm font-medium">{l.label}</span>
                </div>
                {l.soon && (
                  <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                    Sắp ra mắt
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Header: compact dropdown
  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm font-medium text-foreground transition hover:border-accent hover:text-accent"
      >
        <ActiveFlag className="size-5 shrink-0 rounded-sm shadow-sm" />
        <span>{active.short}</span>
        <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-lg border border-border bg-background p-1 shadow-lg">
          {languages.map((l) => {
            const isActive = l.code === lang;
            const Flag = l.Flag;
            return (
              <div
                key={l.code}
                role="option"
                aria-selected={isActive}
                className={`flex items-center justify-between rounded-md px-3 py-2 text-sm ${
                  isActive
                    ? "bg-secondary font-medium text-foreground"
                    : "text-muted-foreground opacity-60"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Flag className="size-5 shrink-0 rounded-sm shadow-sm" />
                  {isActive && <Check className="size-3.5" />}
                  <span>{l.label}</span>
                </div>
                {l.soon && (
                  <span className="rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-tighter text-accent-foreground">
                    Soon
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
