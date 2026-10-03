// src/components/floating-contact.tsx
// Floating contact bar for quick customer outreach.
// Order: Phone -> Zalo -> Facebook -> Message (Messenger).
import { Phone } from "lucide-react";

interface ContactItem {
  id: string;
  href: string;
  label: string;
  title: string;
  bg: string;
  icon: React.ReactNode;
}

function ZaloIcon({ className = "size-5" }: { className?: string }) {
  return (
    <img src="/zalo.png" alt="Zalo" className={`object-contain brightness-0 invert ${className}`} />
  );
}

function FacebookIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.096 10.125 24v-8.437H7.078v-3.49h3.047V9.44c0-3.026 1.792-4.706 4.533-4.706 1.313 0 2.686.236 2.686.236v2.97h-1.513c-1.49 0-1.955.931-1.955 1.887v2.26h3.328l-.532 3.49h-2.796V24C19.612 23.096 24 18.1 24 12.073z" />
    </svg>
  );
}

function MessengerIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.373 0 0 4.975 0 11.115c0 3.498 1.744 6.616 4.472 8.652V24l4.086-2.242c1.09.301 2.246.465 3.442.465 6.627 0 12-4.975 12-11.116C24 4.975 18.627 0 12 0zm1.193 14.963l-3.056-3.26-5.963 3.26 6.559-6.963 3.13 3.26 5.889-3.26-6.559 6.963z" />
    </svg>
  );
}

const contacts: ContactItem[] = [
  {
    id: "phone",
    href: "tel:0392969000",
    label: "Gọi ngay",
    title: "Hotline: 0392 969 000",
    bg: "bg-[#25d366] hover:bg-[#1ebe5a]",
    icon: <Phone className="size-5" />,
  },
  {
    id: "zalo",
    href: "https://zalo.me/0392969000",
    label: "Zalo",
    title: "Chat Zalo: 0392 969 000",
    bg: "bg-[#0068ff] hover:bg-[#0056d6]",
    icon: <ZaloIcon className="size-5" />,
  },
  {
    id: "facebook",
    href: "https://www.facebook.com/sharetosmile12",
    label: "Facebook",
    title: "Fanpage BiBi Studio",
    bg: "bg-[#1877f2] hover:bg-[#1466d2]",
    icon: <FacebookIcon className="size-5" />,
  },
  {
    id: "messenger",
    href: "https://m.me/sharetosmile12",
    label: "Messenger",
    title: "Nhắn tin Messenger",
    bg: "bg-[#0084ff] hover:bg-[#0070d9]",
    icon: <MessengerIcon className="size-5" />,
  },
];

export function FloatingContact() {
  return (
    <div
      className="fixed inset-x-0 bottom-3 z-40 mx-auto flex w-fit items-center gap-2 rounded-full border border-border bg-background/95 p-1.5 shadow-lg backdrop-blur md:inset-x-auto md:bottom-auto md:right-3 md:top-1/2 md:mx-0 md:-translate-y-1/2 md:flex-col md:gap-3 md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none"
      aria-label="Liên hệ mua hàng"
    >
      {contacts.map((c) => (
        <a
          key={c.id}
          href={c.href}
          target={c.href.startsWith("http") ? "_blank" : undefined}
          rel={c.href.startsWith("http") ? "noopener noreferrer" : undefined}
          title={c.title}
          aria-label={c.title}
          className="group relative flex items-center justify-center"
        >
          {/* Tooltip label */}
          <span className="pointer-events-none absolute right-full mr-3 hidden items-center whitespace-nowrap rounded-md bg-foreground/90 px-3 py-1.5 text-xs font-semibold text-background opacity-0 shadow-lg backdrop-blur-sm transition-all duration-300 ease-out translate-x-3 scale-95 group-hover:translate-x-0 group-hover:opacity-100 group-hover:scale-100 md:flex">
            {c.label}
            {/* Arrow */}
            <span className="absolute -right-1 top-1/2 size-2 -translate-y-1/2 rotate-45 bg-foreground/90" />
          </span>

          {/* Contact button circle */}
          <span
            className={`relative flex size-10 items-center justify-center rounded-full text-white shadow-sm transition-all duration-300 ease-out group-hover:scale-110 group-hover:shadow-xl active:scale-95 md:size-11 ${c.bg}`}
          >
            <span className="shrink-0 transition-transform duration-300 ease-out group-hover:scale-110 group-hover:-rotate-6">
              {c.icon}
            </span>
          </span>
        </a>
      ))}
    </div>
  );
}
