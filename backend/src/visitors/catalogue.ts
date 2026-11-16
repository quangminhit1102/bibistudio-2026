import { z } from "zod";

const manifestSchema = z.object({
  version: z.literal(1),
  routes: z.array(z.object({ path: z.string().max(512), label: z.string() })),
  products: z.array(z.object({ slug: z.string().max(160), name: z.string() })),
});
export function createCatalogue(input: unknown) {
  const manifest = manifestSchema.parse(input);
  return {
    routes: new Map(manifest.routes.map((route) => [route.path, route.label])),
    products: new Map(manifest.products.map((product) => [product.slug, product.name])),
  };
}
export type Catalogue = ReturnType<typeof createCatalogue>;
export function mergePublishedCatalogue(
  base: Catalogue,
  active: {
    routes: Array<{ path: string; label: string }>;
    products?: Array<{ slug: string; name: string }>;
  },
): Catalogue {
  const routes = new Map([...base.routes].filter(([path]) => !/^\/blog(?:[/?#]|$)/.test(path)));
  for (const route of active.routes)
    if (/^\/blog(?:\/[a-z0-9-]+)*$/.test(route.path)) routes.set(route.path, route.label);
  return { routes, products: base.products };
}
export function publicPath(value: string, catalogue: Catalogue): string | undefined {
  const path = value.split(/[?#]/, 1)[0];
  return catalogue.routes.has(path) ? path : undefined;
}
