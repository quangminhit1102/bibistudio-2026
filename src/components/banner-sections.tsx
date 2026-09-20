import { Link } from "@tanstack/react-router";

const banners = [
  {
    img: "https://placehold.co/600x600?text=600x600",
    title: "Tập B5 gáy còng nhựa",
    href: "https://sthm.vn/back-to-school",
    wide: true,
  },
  {
    img: "https://placehold.co/600x290?text=600x290",
    title: "Tập B5 gáy còng nhựa",
    href: "https://sthm.vn/tap-b5-lo-xo-nhua-80-trang",
    wide: false,
  },
  {
    img: "https://placehold.co/600x290?text=600x290",
    title: "Tập B5 200 trang",
    href: "https://sthm.vn/tap-may-chi-b5-giay-kem-80gsm-200-trang",
    wide: false,
  },
];

const collections = [
  {
    img: "https://placehold.co/400x400?text=400x400",
    title: "Notebook",
    slug: "collection-notebook",
  },
  {
    img: "https://placehold.co/400x400?text=400x400",
    title: "Scrapbook & DIY",
    slug: "scrapbook-diy",
  },
  {
    img: "https://placehold.co/400x400?text=400x400",
    title: "Bút, phụ kiện",
    slug: "but-phu-kien",
  },
  {
    img: "https://placehold.co/400x400?text=400x400",
    title: "Collection Notebook",
    slug: "new-arrival",
  },
];

export function BannerGrid() {
  return (
    <section className="mx-auto max-w-[1200px] px-4 py-10">
      <div className="grid gap-5 md:grid-cols-2">
        <a href={banners[0].href} className="group block overflow-hidden">
          <img
            src={banners[0].img}
            alt={banners[0].title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        </a>
        <div className="grid gap-5">
          {banners.slice(1).map((b) => (
            <a key={b.img} href={b.href} className="group block overflow-hidden">
              <img
                src={b.img}
                alt={b.title}
                loading="lazy"
                className="w-full object-cover transition duration-500 group-hover:scale-[1.03]"
              />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CollectionTiles() {
  return (
    <section className="mx-auto max-w-[1280px] px-4 pb-14 lg:px-12">
      <div className="mb-6 flex items-end justify-between gap-4">
        <h2 className="text-xl font-bold tracking-tight text-foreground md:text-[22px]">
          Bộ Sưu Tập
        </h2>
        <Link
          to="/collections/$slug"
          params={{ slug: "back-to-school" }}
          className="shrink-0 text-[13px] font-semibold text-accent underline-offset-4 hover:underline"
        >
          Xem Thêm
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        {collections.map((c) => (
          <Link
            key={c.img}
            to="/collections/$slug"
            params={{ slug: c.slug }}
            className="group block"
          >
            <div className="overflow-hidden bg-secondary">
              <img
                src={c.img}
                alt={c.title}
                loading="lazy"
                className="aspect-square w-full object-cover transition duration-500 group-hover:scale-[1.04]"
              />
            </div>
            <h3 className="mt-3 text-[13px] font-semibold text-foreground transition group-hover:text-accent">
              {c.title}
            </h3>
            <span className="mt-0.5 block text-[12px] text-muted-foreground">Xem tất cả</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
