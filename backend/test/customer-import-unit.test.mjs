import test from "node:test";
import assert from "node:assert/strict";

test("customer duplicate keys normalize spaces, case and phone punctuation without matching blanks", async () => {
  const { normalizeName, phoneDigits, normalizeEmail, duplicateKeys, inferKind } =
    await import("../dist/content/customer-import.js");
  assert.equal(normalizeName("  Công TY   AnH Thư "), "công ty anh thư");
  assert.equal(phoneDigits("(+84) 912-345"), "84912345");
  assert.equal(normalizeEmail("  HELLO@Example.COM "), "hello@example.com");
  assert.deepEqual(
    duplicateKeys(
      { name: " A  B ", phone: "012-34", email: "A@B.COM" },
      { name: "a b", phone: "01234", email: "a@b.com" },
    ),
    ["name", "phone", "email"],
  );
  assert.deepEqual(duplicateKeys({ name: "A" }, { name: "B", phone: "", email: null }), []);
  assert.equal(inferKind("Chi nhánh CÔNG TY A"), "company");
  assert.equal(inferKind("cty A"), "company");
  assert.equal(inferKind("Nhà sách A"), "bookstore");
  assert.equal(inferKind("NXB A"), "bookstore");
  assert.equal(inferKind("Anh A"), "individual");
});
