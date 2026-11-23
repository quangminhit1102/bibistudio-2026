import type { HomePageProps } from "@/platform/site-contract";

export default function HomePage({ products }: HomePageProps) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-24">
      <h1 className="text-3xl">Northwind Studio</h1>
      <p>{products.length} sản phẩm</p>
    </main>
  );
}
