import { expect, it } from "vitest";
import { extractImportEmail } from "../../src/features/admin/customers/import/parse";
import { isRecordEmail, trimTrailingSlashes } from "../../src/features/admin/shared/lib/text";
import { slugifyHeading } from "../../src/lib/content-html";
import { moduleForAdminPath } from "../../src/features/admin/modules";
import { legacyDestination } from "../../src/features/admin/shell/legacy-destination";

it("extracts exactly the same first email from notes, including permissive punctuation", () => {
  const old = (value: string) => value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  const values = [
    "",
    "@",
    "a@.com",
    "a@..com",
    "Liên hệ A+B_%@Example.COM, other@valid.test",
    "a@bad x@y.test",
    "a@@x.test",
    "a@x.c b@y.test",
    "a@x.test123",
    "a@x.test.yz-",
    "a@x.test._b@y.test",
    "a@x.test+another@y.test",
    "a@x.éé",
    "a@x.CÖ",
    "a@x.COM\n",
    "a".repeat(2048),
    "a@" + ".".repeat(2048),
    "a@" + "x.".repeat(1024) + "com",
  ];
  for (const value of values) expect(extractImportEmail(value), value).toBe(old(value));
  expect(extractImportEmail("a".repeat(100_000))).toBeUndefined();
});

it("keeps the email form's accepted and rejected strings unchanged", () => {
  const old = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const values = [
    "",
    "a@b.c",
    "a@..b",
    "a@a..",
    "a@.b",
    "@a.b",
    "a@@b.c",
    "a@b",
    "a b@c.d",
    "a@b.c\n",
    "a@b.c\r\n",
    "a@b.c\u2028",
    "a@b.c\u00a0",
    "é@例.子",
    "a@b/c.d",
    "x".repeat(2048),
    "a@" + ".".repeat(2048),
    "a@" + "a.".repeat(1024) + "b",
  ];
  const alphabet = ["a", "@", ".", " ", "\n"];
  for (let size = 0; size < 6; size++)
    for (let index = 0; index < alphabet.length ** size; index++) {
      let number = index;
      let value = "";
      for (let digit = 0; digit < size; digit++) {
        value += alphabet[number % alphabet.length];
        number = Math.floor(number / alphabet.length);
      }
      values.push(value);
    }
  for (const value of values) expect(isRecordEmail(value), JSON.stringify(value)).toBe(old(value));
  expect(isRecordEmail("a@" + "x".repeat(100_000))).toBe(false);
});

it("trims only trailing slashes, including empty and long runs", () => {
  for (const value of [
    "",
    "/",
    "////",
    "/a//b///",
    "/a/\n",
    "/".repeat(4096),
    "/admin/customers" + "/".repeat(4096),
  ]) {
    expect(trimTrailingSlashes(value)).toBe(value.replace(/\/+$/, ""));
  }
  expect(moduleForAdminPath("/admin/customers" + "/".repeat(4096))).toBe("customers");
  expect(legacyDestination("/admin/bookstore" + "/".repeat(4096))).toEqual({
    to: "/admin/customers",
  });
  expect(legacyDestination("/".repeat(4096))).toBeNull();
});

it("preserves heading slugs after collapsing and trimming dash runs", () => {
  for (const value of [
    "",
    "-",
    "-----",
    "--Đà Nẵng--",
    "a--b",
    "-".repeat(100_000),
    "!".repeat(4096) + "Heading" + "-".repeat(4096),
  ]) {
    const base = value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/gi, "d")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    expect(slugifyHeading(value, 3)).toBe(`${base || "muc"}-3`);
  }
});
