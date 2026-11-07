import { render, screen, within } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import type { ReactNode } from "react";
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  Link: ({
    to,
    params,
    hash,
    children,
    ...props
  }: {
    to: string;
    params?: { slug: string };
    hash?: string;
    children: ReactNode;
  }) => (
    <a href={to.replace("$slug", params?.slug ?? "") + (hash ? `#${hash}` : "")} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/page-shell", () => ({
  PageShell: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
import { Route } from "@/routes/index";
import { getAllProducts, occasions, productsByOccasion, productTypes } from "@/data/catalogue";

describe("homepage discovery", () => {
  it("introduces products with a static hero and two existing destinations", () => {
    const Home = Route.options.component!;
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Sổ tay, thiệp và những món quà mang nét Việt.",
    );
    const hero = screen.getByRole("region", { name: "BiBi Studio" });
    expect(within(hero).getByRole("link", { name: "Xem các mẫu" })).toHaveAttribute(
      "href",
      "/products",
    );
    expect(within(hero).getByRole("link", { name: "Bộ sưu tập" })).toHaveAttribute(
      "href",
      "/collections",
    );
    expect(within(hero).queryByRole("button")).not.toBeInTheDocument();
  });
  it("puts all six type links before six real featured products", () => {
    const Home = Route.options.component!;
    render(<Home />);
    const types = screen.getByRole("region", { name: "Bạn muốn xem gì?" });
    const featured = screen.getByRole("region", { name: "Mẫu BiBi chọn" });
    expect(types.compareDocumentPosition(featured) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(types).getAllByRole("link")).toHaveLength(6);
    productTypes.forEach((t) =>
      expect(within(types).getByRole("link", { name: t.name.vi })).toHaveAttribute(
        "href",
        `/products/${t.slug}`,
      ),
    );
    const cards = within(featured)
      .getAllByRole("link")
      .filter((a) => a.getAttribute("href")?.startsWith("/products/"));
    expect(cards).toHaveLength(6);
    cards.forEach((a) =>
      expect(getAllProducts().some((p) => `/products/${p.slug}` === a.getAttribute("href"))).toBe(
        true,
      ),
    );
  });
  it("only promotes occasions with available products", () => {
    const Home = Route.options.component!;
    render(<Home />);
    const region = screen.getByRole("region", { name: "Một tấm thiệp cho mỗi dịp" });
    const links = within(region)
      .getAllByRole("link")
      .filter((a) => a.hash);
    expect(links.length).toBeGreaterThan(0);
    expect(links.length).toBeLessThanOrEqual(4);
    links.forEach((a) => {
      const occasion = occasions.find((o) => `#${o.id}` === a.hash)!;
      expect(occasion).toBeDefined();
      expect(productsByOccasion(occasion.id).length).toBeGreaterThan(0);
    });
  });
});
