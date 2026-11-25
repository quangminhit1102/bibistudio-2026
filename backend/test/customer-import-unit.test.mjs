import test from "node:test";
import assert from "node:assert/strict";

test("import caps stay below 8 MB and bound escaped JSON for every text field and extra", async () => {
  const { CUSTOMER_IMPORT_MAX_BYTES, validateImportFields } =
    await import("../dist/content/customer-import.js");
  assert.ok(CUSTOMER_IMPORT_MAX_BYTES <= 8_000_000);
  for (const [field, value] of [
    ["name", "\u0000".repeat(255)],
    ["representative", "\u0000".repeat(255)],
    ["phone", "\u0000".repeat(50)],
    ["address", "a".repeat(1023)],
    ["notes", "n".repeat(2047)],
    [
      "extra",
      {
        a: "a".repeat(500),
        b: "b".repeat(500),
        c: "c".repeat(500),
        d: "d".repeat(500),
        e: "e".repeat(500),
      },
    ],
  ]) {
    const parsed = validateImportFields({ name: "Valid", [field]: value }, false);
    assert.equal(parsed.success, false, field);
    assert.ok(parsed.error.issues.some((issue) => issue.path[0] === field));
  }
  assert.equal(
    validateImportFields({ name: "Valid", address: "", notes: null, extra: {} }, false).success,
    true,
  );
});

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
