import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/platform/site", async (importOriginal) => {
  const { defineSite } = await import("@/platform/site-contract");
  return {
    ...(await importOriginal<typeof import("@/platform/site")>()),
    site: defineSite({
      name: "Example",
      shortName: "Ex",
      url: "https://example.com",
      locales: ["vi"],
      defaultLocale: "vi",
      contact: {
        phone: "0900000000",
        phoneDisplay: "0900 000 000",
        email: "a@example.com",
        social: [{ id: "tiktok", label: "TikTok", href: "https://tiktok.com/@example" }],
      },
      seo: { titleSuffix: "", description: "" },
      fonts: [],
      admin: { title: "Admin", modules: [] },
    }),
  };
});

import { ContactLinks } from "@/components/contact-cta";
import { FloatingContact } from "@/components/floating-contact";
import { ProductContactBar } from "@/components/product-contact-bar";

const hrefs = () => screen.getAllByRole("link").map((a) => a.getAttribute("href"));

describe("contact components on a site without Zalo, Facebook or Messenger", () => {
  it("lists phone, email and the site's own channels only", () => {
    render(<ContactLinks />);
    expect(hrefs()).toEqual([
      "tel:0900000000",
      "mailto:a@example.com",
      "https://tiktok.com/@example",
    ]);
    expect(screen.getByText("TikTok", { selector: ".eyebrow" })).toBeTruthy();
  });

  it("shows only the phone button in the floating bar", () => {
    render(<FloatingContact />);
    expect(hrefs()).toEqual(["tel:0900000000"]);
  });

  it("shows only the call button in the product bar", () => {
    render(<ProductContactBar name="Sổ A" />);
    expect(hrefs()).toEqual(["tel:0900000000"]);
  });
});
