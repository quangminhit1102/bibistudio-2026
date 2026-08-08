// src/components/layout/UtilityBar.tsx
// Top utility bar: phone, email, and order tracking links.
import { Phone, Mail, ClipboardList } from "lucide-react";

export function UtilityBar() {
  return (
    <div className="border-b border-border">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-4 py-2 text-sm">
        <div className="flex items-center gap-6">
          <a href="tel:0967495867" className="flex items-center gap-2 hover:text-accent">
            <span className="flex size-6 items-center justify-center rounded-full bg-sage/60 text-primary">
              <Phone className="size-3.5" />
            </span>
            0967495867
          </a>
          <a
            href="mailto:sthm.vn@gmail.com"
            className="hidden items-center gap-2 hover:text-accent sm:flex"
          >
            <span className="flex size-6 items-center justify-center rounded-full bg-sage/60 text-primary">
              <Mail className="size-3.5" />
            </span>
            sthm.vn@gmail.com
          </a>
        </div>
        <a href="#" className="flex items-center gap-2 hover:text-accent">
          <span className="flex size-6 items-center justify-center rounded-full bg-accent/15 text-accent">
            <ClipboardList className="size-3.5" />
          </span>
          <span className="hidden sm:inline">Kiểm tra đơn hàng</span>
        </a>
      </div>
    </div>
  );
}
