import { Link } from "@tanstack/react-router";
import { BrandLogo } from "./brand-logo";
import { collections, productTypes, tx } from "@/data/catalogue";
import { contact } from "@/data/contact";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto grid max-w-[1280px] gap-12 px-6 py-16 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-12">
        <div>
          <BrandLogo />
          <p className="mt-6 max-w-xs font-display text-xl italic leading-snug text-muted-foreground">
            Little things, made to touch your heart.
          </p>
        </div>

        <div>
          <h3 className="eyebrow mb-5">Sản phẩm</h3>
          <ul className="space-y-2.5 text-sm">
            {productTypes.map((t) => (
              <li key={t.id}>
                <Link to="/products/$slug" params={{ slug: t.slug }} className="hover:text-accent">
                  {tx(t.plural)}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="eyebrow mb-5">Bộ sưu tập</h3>
          <ul className="space-y-2.5 text-sm">
            {collections.map((c) => (
              <li key={c.id}>
                <Link to="/collections/$slug" params={{ slug: c.slug }} className="hover:text-accent">
                  {tx(c.name)}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="eyebrow mb-5">Studio</h3>
          <ul className="space-y-2.5 text-sm">
            <li><Link to="/about" className="hover:text-accent">Về BiBi Studio</Link></li>
            <li><Link to="/blog" className="hover:text-accent">Nhật ký</Link></li>
            <li><Link to="/contact" className="hover:text-accent">Liên hệ</Link></li>
            <li className="pt-3"><a href={`tel:${contact.phone}`} className="hover:text-accent">{contact.phoneDisplay}</a></li>
            <li><a href={`mailto:${contact.email}`} className="hover:text-accent">{contact.email}</a></li>
            <li className="flex gap-4 pt-1">
              <a href={contact.zalo} target="_blank" rel="noopener noreferrer" className="hover:text-accent">Zalo</a>
              <a href={contact.facebook} target="_blank" rel="noopener noreferrer" className="hover:text-accent">Facebook</a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-[1280px] px-6 pt-5 pb-24 text-[11px] tracking-wider text-muted-foreground md:pb-5 lg:px-12">
          © {new Date().getFullYear()} BiBi Studio · Touch your heart
        </p>
      </div>
    </footer>
  );
}
