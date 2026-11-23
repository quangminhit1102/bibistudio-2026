import { Link } from "@tanstack/react-router";
import { Mail, Phone } from "lucide-react";
import { mailHref, telHref } from "@/lib/site-contact";
import { site } from "@/platform/site";
import { t } from "@/lib/messages";

export function ContactLinks({ className = "" }: { className?: string }) {
  const items = [
    { label: t("contact.phone"), value: site.contact.phoneDisplay, href: telHref(site), Icon: Phone },
    { label: t("contact.email"), value: site.contact.email, href: mailHref(site), Icon: Mail },
    ...site.contact.social.map((link) => ({
      label: link.label,
      value: link.display ?? link.label,
      href: link.href,
    })),
  ];
  return (
    <ul className={`divide-y divide-border border-y border-border ${className}`}>
      {items.map((i) => (
        <li key={i.label}>
          <a
            href={i.href}
            target={i.href.startsWith("http") ? "_blank" : undefined}
            rel={i.href.startsWith("http") ? "noopener noreferrer" : undefined}
            className="grid min-h-12 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 text-sm transition hover:text-accent"
          >
            <span className="eyebrow">{i.label}</span>
            <span className="min-w-0 break-all text-right">{i.value}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export function ContactBand() {
  return (
    <section className="paper-texture">
      <div className="mx-auto grid max-w-[1280px] gap-10 px-5 py-20 sm:px-6 md:grid-cols-[1.2fr_1fr] md:items-end md:py-32 lg:px-12">
        <div>
          <p className="eyebrow">{t("nav.contact")}</p>
          <h2 className="mt-5 font-display text-[2.35rem] leading-[1.05] text-foreground sm:text-4xl md:text-6xl">
            {t("contactBand.title")}
            <br />
            <em className="text-kraft">{t("contactBand.accent")}</em>
          </h2>
          <p className="mt-6 max-w-md text-[15px] leading-relaxed text-muted-foreground">
            {t("contactBand.text")}
          </p>
          <Link
            to="/contact"
            className="mt-8 inline-flex items-center gap-3 bg-foreground px-7 py-3.5 text-[12px] font-medium uppercase tracking-[0.22em] text-background transition hover:bg-accent"
          >
            {t("contactBand.action")}
          </Link>
        </div>
        <ContactLinks />
      </div>
    </section>
  );
}
