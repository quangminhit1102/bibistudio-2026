import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { Heart, ShoppingBag, Truck, RotateCcw, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ProductCard } from "@/components/product-card";
import { findProduct, getProductDetail, relatedProducts, type ProductDetail } from "@/data/catalog";
import { SimpleBreadcrumb } from "@/components/ui/simple-breadcrumb";
import { QuantityInput } from "@/components/ui/quantity-input";
import { ProductImageGallery } from "@/components/product/product-image-gallery";
import { ProductOptions } from "@/components/product/product-options";
import { SITE_URL, buildProductSchema, buildBreadcrumbSchema } from "@/lib/seo";

function buildDetail(handle: string): ProductDetail | undefined {
  const detail = getProductDetail(handle);
  if (detail) return detail;
  const p = findProduct(handle);
  if (!p) return undefined;
  return {
    handle: p.handle,
    name: p.name,
    price: p.price,
    old: p.old,
    discount: null,
    stock: "Còn hàng",
    sku: p.handle.slice(0, 12).toUpperCase(),
    vendor: "BiBi Studio",
    images: [p.img],
    options: [],
    description: ["Thông tin sản phẩm đang được cập nhật."],
    highlights: [],
  };
}

export const Route = createFileRoute("/products/$handle")({
  loader: ({ params }) => {
    const product = buildDetail(params.handle);
    if (!product) throw notFound();
    return { product, related: relatedProducts(params.handle) };
  },
  head: ({ params, loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Không tìm thấy sản phẩm — BiBi Studio" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const p = loaderData.product;
    const title = `${p.name} — BiBi Studio`;
    const description = `${p.name} chỉ ${p.price} tại BiBi Studio. Giấy cao cấp, gia công tỉ mỉ, giao hàng toàn quốc.`;
    const url = `${SITE_URL}/products/${params.handle}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "product" },
        { property: "og:url", content: url },
        { property: "og:image", content: p.images[0] },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:image", content: p.images[0] },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(buildProductSchema(p)),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify(
            buildBreadcrumbSchema([
              { name: "Trang chủ", url: SITE_URL },
              { name: "Back to School", url: `${SITE_URL}/collections/back-to-school` },
              { name: p.name, url },
            ]),
          ),
        },
      ],
    };
  },
  notFoundComponent: ProductNotFound,
  component: ProductPage,
});

function ProductNotFound() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-[1280px] px-4 py-24 text-center lg:px-12">
        <h1 className="text-2xl font-bold">Không tìm thấy sản phẩm</h1>
        <Link to="/" className="mt-4 inline-block text-accent underline">
          Về trang chủ
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}

const tabs = ["Mô tả", "Đánh giá", "Hướng dẫn đặt hàng"] as const;

function ProductPage() {
  const { product, related } = Route.useLoaderData();

  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState<number>(0);
  const [choices, setChoices] = useState<Record<string, string>>(() =>
    Object.fromEntries(product.options.map((o) => [o.label, o.values[0]])),
  );

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <div className="border-b border-border bg-secondary/60">
          <div className="mx-auto max-w-[1280px] px-4 py-4 text-[12px] text-muted-foreground lg:px-12">
            <SimpleBreadcrumb
              crumbs={[
                { label: "Trang chủ", to: "/" },
                { label: "Back to School", slug: "back-to-school" },
                { label: product.name },
              ]}
            />
          </div>
        </div>

        <section className="mx-auto max-w-[1280px] px-4 py-10 lg:px-12">
          <div className="grid gap-10 lg:grid-cols-2">
            <ProductImageGallery images={product.images} name={product.name} />

            <div>
              <h1 className="text-[22px] font-bold leading-snug text-foreground md:text-[26px]">
                {product.name}
              </h1>

              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-muted-foreground">
                <span>
                  Thương hiệu: <span className="text-foreground">{product.vendor}</span>
                </span>
                <span>
                  Tình trạng: <span className="text-foreground">{product.stock}</span>
                </span>
                <span>
                  SKU: <span className="text-foreground">{product.sku}</span>
                </span>
              </div>

              <div className="mt-5 flex items-baseline gap-3 border-y border-border py-4">
                <span className="text-2xl font-bold text-accent">{product.price}</span>
                {product.old && (
                  <span className="text-[13px] text-muted-foreground line-through">
                    {product.old}
                  </span>
                )}
                {product.discount && (
                  <span className="bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                    {product.discount}
                  </span>
                )}
              </div>

              <ProductOptions
                options={product.options}
                choices={choices}
                onChange={(label, value) => setChoices((c) => ({ ...c, [label]: value }))}
              />

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <QuantityInput value={qty} onChange={setQty} />
                <button
                  type="button"
                  className="flex h-10 flex-1 items-center justify-center gap-2 bg-primary px-6 text-[13px] font-semibold uppercase tracking-wide text-primary-foreground transition hover:bg-accent hover:text-accent-foreground"
                >
                  <ShoppingBag className="size-4" /> Thêm vào giỏ hàng
                </button>
                <button
                  type="button"
                  aria-label="Thêm vào yêu thích"
                  className="flex size-10 items-center justify-center border border-border text-foreground transition hover:border-accent hover:text-accent"
                >
                  <Heart className="size-4" />
                </button>
              </div>

              <p className="mt-4 text-[13px] text-muted-foreground">
                Gọi đặt mua:{" "}
                <a href="tel:0392969000" className="font-semibold text-accent">
                  0392 969 000
                </a>{" "}
                (9h–21h mỗi ngày)
              </p>

              <ul className="mt-6 space-y-2 border-t border-border pt-5 text-[13px] text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Truck className="size-4 text-accent" /> Giao hàng toàn quốc, freeship đơn từ
                  350.000₫
                </li>
                <li className="flex items-center gap-2">
                  <RotateCcw className="size-4 text-accent" /> Đổi trả trong 7 ngày nếu lỗi sản xuất
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-accent" /> Sản phẩm chính hãng BiBi Studio
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1280px] px-4 pb-12 lg:px-12">
          <div className="flex gap-6 border-b border-border">
            {tabs.map((t, i) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(i)}
                className={`-mb-px border-b-2 pb-3 text-[14px] font-semibold transition ${tab === i
                  ? "border-accent text-accent"
                  : "border-transparent text-muted-foreground"
                  }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="pt-6 text-[14px] leading-relaxed text-muted-foreground">
            {tab === 0 && (
              <div className="space-y-4">
                {product.description.map((d) => (
                  <p key={d}>{d}</p>
                ))}
                {product.highlights.length > 0 && (
                  <>
                    <h2 className="pt-2 text-[15px] font-bold text-foreground">Đặc điểm nổi bật</h2>
                    <ul className="list-disc space-y-2 pl-5">
                      {product.highlights.map((h) => (
                        <li key={h}>{h}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
            {tab === 1 && <p>Chưa có đánh giá cho sản phẩm này.</p>}
            {tab === 2 && (
              <ol className="list-decimal space-y-2 pl-5">
                <li>Chọn mẫu và số lượng, thêm sản phẩm vào giỏ hàng.</li>
                <li>Nhập thông tin nhận hàng và chọn phương thức thanh toán.</li>
                <li>Nhận xác nhận đơn hàng qua điện thoại hoặc email trong 24 giờ.</li>
              </ol>
            )}
          </div>
        </section>

        <section className="mx-auto max-w-[1280px] px-4 pb-16 lg:px-12">
          <h2 className="mb-6 text-xl font-bold tracking-tight text-foreground">
            Sản phẩm liên quan
          </h2>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
            {related.map((p) => (
              <ProductCard key={p.handle} product={p} />
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
