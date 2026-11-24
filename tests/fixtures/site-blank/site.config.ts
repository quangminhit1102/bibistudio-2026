import { defineSite } from "../../../src/platform/site-contract.ts";

// The smallest site the platform accepts. CI builds it to prove that core does not depend
// on one brand; `node scripts/new-site.mjs` starts a new site from a copy of this folder.
// Its name, domain, phone and email must not occur in core code (the boundary test).
export default defineSite({
  name: "Northwind Studio",
  shortName: "Northwind",
  url: "https://northwind.test",
  locales: ["vi"],
  defaultLocale: "vi",
  contact: {
    phone: "0900000000",
    phoneDisplay: "0900 000 000",
    email: "hello@northwind.test",
    social: [],
  },
  seo: {
    titleSuffix: " — Northwind Studio",
    description: "Northwind Studio.",
  },
  fonts: [],
  admin: {
    title: "Northwind Admin",
    // Every module is on so the whole admin test suite runs against this site.
    modules: [
      "content",
      "products",
      "inventory",
      "customers",
      "sales",
      "analytics",
      "accounts",
      "audit",
      "notifications",
      "settings",
      "components",
    ],
  },
});
