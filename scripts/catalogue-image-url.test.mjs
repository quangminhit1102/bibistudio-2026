import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveCatalogueImageUrl } from "../src/lib/catalogue-image-url.ts";
test("production catalogue URLs stay rooted at catalogue", () => {
  assert.equal(resolveCatalogueImageUrl("/catalogue/example.jpeg", "/"), "/catalogue/example.jpeg");
});
test("temporary catalogue URLs use the hosting prefix", () => {
  assert.equal(
    resolveCatalogueImageUrl("/catalogue/example.jpeg", "/~vhplasti/"),
    "/~vhplasti/catalogue/example.jpeg",
  );
});
