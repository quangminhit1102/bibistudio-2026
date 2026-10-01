import { Link } from "@tanstack/react-router";
import { Mail, Phone } from "lucide-react";
import { contact } from "@/data/contact";

export function ContactLinks({ className = "" }: { className?: string }) {
  const items = [
    { label: "Điện thoại", value: contact.phoneDisplay, href: `tel:${contact.phone}`, Icon: Phone },
    { label: "Email", value: contact.email, href: `mailto:${contact.email}`, Icon: Mail },
    { label: "Zalo", value: contact.phoneDisplay, href: contact.zalo },
    { label: "Facebook", value: "BiBi Studio", href: contact.facebook },
    { label: "Messenger", value: "Nhắn tin", href: contact.messenger },
  ];
  return (
    <ul className={`divide-y divide-border border-y border-border ${className}`}>
      {items.map((i) => (
        <li key={i.label}>
          <a
            href={i.href}
            target={i.href.startsWith("http") ? "_blank" : undefined}
            rel={i.href.startsWith("http") ? "noopener noreferrer" : undefined}
            className="flex items-center justify-between gap-4 py-3.5 text-sm transition hover:text-accent"
          >
            <span className="eyebrow">{i.label}</span>
            <span>{i.value}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export function ContactBand() {
  return (
    <section className="paper-texture">
      <div className="mx-auto grid max-w-[1280px] gap-10 px-6 py-24 md:grid-cols-[1.2fr_1fr] md:items-end md:py-32 lg:px-12">
        <div>
          <p className="eyebrow">Liên hệ</p>
          <h2 className="mt-5 font-display text-4xl leading-[1.05] text-foreground md:text-6xl">
            Bạn thích một sản phẩm?
            <br />
            <em className="text-kraft">Hãy trò chuyện cùng BiBi.</em>
          </h2>
          <p className="mt-6 max-w-md text-[15px] leading-relaxed text-muted-foreground">
            Gọi điện, nhắn Zalo hoặc gửi email — BiBi Studio sẽ phản hồi bạn sớm nhất.
          </p>
          <Link
            to="/contact"
            className="mt-8 inline-flex items-center gap-3 bg-foreground px-7 py-3.5 text-[12px] font-medium uppercase tracking-[0.22em] text-background transition hover:bg-accent"
          >
            Liên hệ BiBi Studio
          </Link>
        </div>
        <ContactLinks />
      </div>
    </section>
  );
}
