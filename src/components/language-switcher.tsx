// src/components/language-switcher.tsx
// Vietnamese / English language control. English is shown as "coming soon".
// Provides a compact pill for desktop and a vertical list for the mobile drawer.

import { useState } from "react";

export type Language = "vi" | "en";

interface LanguageSwitcherProps {
  variant?: "pill" | "drawer";
}

export function LanguageSwitcher({ variant = "pill" }: LanguageSwitcherProps) {
  const [lang] = useState<Language>("vi");

  if (variant === "drawer") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between text-muted-foreground px-2">
          <span className="text-xs font-bold uppercase tracking-[0.2em]">
            Ngôn ngữ / Language
          </span>
          <div className="ml-4 h-px flex-1 bg-border" />
        </div>

        <div className="flex flex-col gap-4 px-2">
          {/* Vietnamese — active */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-2 rounded-full bg-foreground" />
              <span className="text-base font-medium text-foreground">Tiếng Việt</span>
            </div>
            <span className="text-xs font-medium text-muted-foreground">Mặc định</span>
          </div>

          {/* English — coming soon */}
          <div className="flex items-center justify-between opacity-40">
            <div className="flex items-center gap-3">
              <div className="size-2 rounded-full border border-muted-foreground bg-transparent" />
              <span className="text-base font-medium text-foreground">English</span>
            </div>
            <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
              Sắp ra mắt
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Compact pill — desktop header
  return (
    <div
      className="relative inline-flex w-full max-w-[9rem] items-center rounded-2xl bg-secondary p-1.5 shadow-inner"
      role="group"
      aria-label="Ngôn ngữ / Language"
    >
      {/* Active sliding indicator */}
      <div className="absolute left-1.5 top-1.5 h-[calc(100%-12px)] w-[calc(50%-6px)] rounded-xl bg-background shadow-sm" />

      {/* Vietnamese (active) */}
      <button
        type="button"
        aria-pressed={lang === "vi"}
        className="relative z-10 flex-1 py-2 text-center text-sm font-semibold text-foreground transition-colors"
      >
        VN
      </button>

      {/* English (coming soon) */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center py-2 opacity-50">
        <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          EN
        </span>
        <span className="absolute -top-3 -right-1 rounded-full bg-accent px-2 py-0.5 text-[9px] font-bold uppercase tracking-tighter text-accent-foreground shadow-lg">
          Soon
        </span>
      </div>
    </div>
  );
}
