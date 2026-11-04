import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createDatabaseFixture } from "./database.mjs";
export async function createVisitorFixture(t, productCount = 4) {
  const fixture = await createDatabaseFixture(t);
  const { migrate } = await import("../../dist/db/migrate.js");
  await migrate(fixture.pool, fileURLToPath(new URL("../../migrations", import.meta.url)));
  const { createCatalogue } = await import("../../dist/visitors/catalogue.js");
  const { collectVisitor } = await import("../../dist/visitors/collector.js");
  const products = Array.from({ length: productCount }, (_, i) => ({
    slug: `product-${i}`,
    name: `Sản phẩm ${i}`,
  }));
  const catalogue = createCatalogue({
    version: 1,
    products,
    routes: [
      { path: "/", label: "Trang chủ" },
      { path: "/contact", label: "Liên hệ" },
      { path: "/products/notebooks", label: "Sổ tay" },
      ...products.map((product) => ({ path: `/products/${product.slug}`, label: product.name })),
    ],
  });
  const idSecret = randomBytes(32).toString("hex");
  const context = (cookie, overrides = {}) => ({
    cookie,
    ip: "192.0.2.123",
    userAgent:
      "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/123.0 Mobile Safari/537.36",
    now: fixture.clock.now(),
    idSecret,
    catalogue,
    ...overrides,
  });
  const collect = (input, cookie, overrides) =>
    collectVisitor(fixture.pool, input, context(cookie, overrides));
  const batch = {
    paths: ["/products/product-0"],
    products: ["product-0"],
    lastPath: "/products/product-0",
  };
  const bootstrap = await collect(batch);
  return {
    ...fixture,
    catalogue,
    context,
    collect,
    batch,
    idSecret,
    cookie: bootstrap.cookie.value,
    bootstrap,
  };
}
