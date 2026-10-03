import type { ReactNode } from "react";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}

export function PageIntro({ eyebrow, title, lead }: { eyebrow: string; title: string; lead?: string }) {
  return (
    <section className="mx-auto max-w-[1280px] px-5 pb-10 pt-12 sm:px-6 md:pb-16 md:pt-24 lg:px-12">
      <p className="eyebrow animate-rise">{eyebrow}</p>
      <h1 className="mt-5 max-w-4xl font-display text-4xl leading-[1.02] text-foreground animate-rise sm:text-5xl md:text-7xl">
        {title}
      </h1>
      {lead && (
        <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-muted-foreground animate-rise">{lead}</p>
      )}
    </section>
  );
}
