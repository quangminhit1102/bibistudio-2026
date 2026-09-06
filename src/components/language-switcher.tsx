// src/components/language-switcher.tsx
// Simple language selector dropdown. Vietnamese is active; English is shown as "coming soon".
import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

export type Language = "vi" | "en";

interface LanguageSwitcherProps {
  variant?: "header" | "drawer";
}

const languages = [
  { code: "vi" as Language, label: "Tiếng Việt", short: "VN" },
  { code: "en" as Language, label: "English", short: "EN", soon: true },
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
            return (
              <div
                key={l.code}
                className={`flex items-center justify-between rounded-md px-3 py-2.5 ${
                  isActive ? "bg-secondary text-foreground" : "text-muted-foreground opacity-60"
                }`}
              >
                <div className="flex items-center gap-3">
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
        className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition hover:border-accent hover:text-accent"
      >
        <span>{active.short}</span>
        <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-44 rounded-lg border border-border bg-background p-1 shadow-lg">
          {languages.map((l) => {
            const isActive = l.code === lang;
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
                <div className="flex items-center gap-2">
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
