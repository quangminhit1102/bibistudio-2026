import { Phone } from "lucide-react";
import { useState } from "react";
import { contact } from "@/data/contact";

/** Phone-only bar pinned to the bottom of a product page; replaces the floating contact buttons there. */
export function ProductContactBar({ name }: { name: string }) {
  const message = `Chào BiBi Studio, mình quan tâm đến mẫu "${name}".`;
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(message).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {});
  };
  const btn = "flex min-h-11 flex-1 items-center justify-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em]";
  return (
    <div data-product-bar className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur md:hidden">
      <p className="truncate text-center text-[11px] text-muted-foreground">
        {copied ? "Đã chép lời nhắn — dán vào Zalo để gửi" : <>Liên hệ về mẫu <span className="text-foreground">{name}</span></>}
      </p>
      <div className="mt-2 flex gap-2">
        <a href={`tel:${contact.phone}`} className={`${btn} border border-border`}><Phone className="size-4" />Gọi</a>
        <a href={contact.zalo} target="_blank" rel="noopener noreferrer" onClick={copy} className={`${btn} border border-border`}>Zalo</a>
        <a href={`${contact.messenger}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" className={`${btn} bg-foreground text-background`}>Nhắn tin</a>
      </div>
    </div>
  );
}
