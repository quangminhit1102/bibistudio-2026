import { useEffect, useId, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { ArrowUpRight, MessageCircle, Phone, X } from "lucide-react";
import { contact } from "@/data/contact";
import "@/styles/floating-contact.css";

const channels = [
  { name: "Gọi điện", detail: contact.phoneDisplay, href: `tel:${contact.phone}` },
  { name: "Zalo", detail: "Trò chuyện với BiBi", href: contact.zalo },
  { name: "Facebook", detail: "Ghé thăm fanpage", href: contact.facebook },
  { name: "Messenger", detail: "Gửi một lời nhắn", href: contact.messenger },
];

export function FloatingContact() {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const href = useRouterState({ select: (state) => state.location.href });
  useEffect(() => {
    setOpen(false);
  }, [href]);
  useEffect(() => {
    const dismiss = () => setOpen(false);
    window.addEventListener("bibi:public-overlay-open", dismiss);
    return () => window.removeEventListener("bibi:public-overlay-open", dismiss);
  }, []);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target))
        setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div
      className="floating-contact public-contact"
      ref={container}
      onBlur={(event) => {
        if (
          event.relatedTarget instanceof Node &&
          !event.currentTarget.contains(event.relatedTarget)
        )
          setOpen(false);
      }}
    >
      <button
        type="button"
        ref={trigger}
        className="public-contact-trigger"
        aria-label="Liên hệ BiBi"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X aria-hidden="true" /> : <MessageCircle aria-hidden="true" />}
        <span>Liên hệ</span>
      </button>
      {open && (
        <nav id={panelId} aria-label="Các kênh liên hệ BiBi" className="public-contact-panel">
          <p>Bạn muốn trò chuyện?</p>
          {channels.map((channel) => (
            <a
              key={channel.name}
              href={channel.href}
              target={channel.href.startsWith("http") ? "_blank" : undefined}
              rel={channel.href.startsWith("http") ? "noopener noreferrer" : undefined}
              onClick={() => setOpen(false)}
            >
              {channel.name === "Gọi điện" ? (
                <Phone aria-hidden="true" />
              ) : (
                <MessageCircle aria-hidden="true" />
              )}
              <span>
                <strong>{channel.name}</strong>
                <small>{channel.detail}</small>
              </span>
              <ArrowUpRight aria-hidden="true" />
            </a>
          ))}
        </nav>
      )}
    </div>
  );
}
