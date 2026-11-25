import { expect, it } from "vitest";
import { parseCustomerWorkbook } from "../../src/features/admin/customers/import/parse";
import { customerSampleWorkbook } from "../../src/features/admin/customers/import/sample";
import { imageNames, imageRows, workbook } from "./customer-import-fixture";

it.each(["Có", "co", "CÓ", "Không", "KHONG", "8", "8%", "10,5", "10.5%", "0", "100%"])(
  "accepts plain VAT value %s",
  async (vat) => {
    const result = await parseCustomerWorkbook(
      await workbook([
        ["Tên", "VAT"],
        ["A", vat],
      ]),
      { extraFields: [] },
    );
    expect(result.errors).toEqual([]);
    expect(result.rows[0].fields.vatRate).toBe(
      /^(có|co)$/i.test(vat)
        ? 8
        : /^(không|khong)$/i.test(vat)
          ? 0
          : Number(vat.replace("%", "").replace(",", ".")),
    );
  },
);
it.each(["0x10", "1e1", "+8", "-1", "101", "100,1%", "8%%", "8.5.2", "maybe"])(
  "reports a row error for VAT text %s",
  async (vat) => {
    const result = await parseCustomerWorkbook(
      await workbook([
        ["Tên", "VAT"],
        ["A", vat],
      ]),
      { extraFields: [] },
    );
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ row: 2, field: "vatRate" })]),
    );
  },
);

it("parses Minh's 29 rows, retaining duplicate names and extracting contacts without extracting a representative", async () => {
  const result = await parseCustomerWorkbook(await workbook(imageRows), { extraFields: [] });
  expect(result.rows).toHaveLength(29);
  expect(result.errors).toEqual([]);
  expect(result.unknownColumns).toEqual([]);
  expect(result.rows.map((r) => r.fields.name)).toEqual(imageNames);
  expect(result.rows[12].fields.email).toBe("sachvietnam@yahoo.com");
  expect(result.rows[17].fields).toMatchObject({
    phone: "0966993407",
    notes: "Người nhận: anh Diệm - 0966993407",
  });
  expect(result.rows[17].fields.representative).toBeUndefined();
  expect(result.rows[0].fields.vatRate).toBe(8);
  expect(result.rows[19].fields.vatRate).toBe(0);
  expect(result.rows[20].fields.address ?? "").toBe("");
});
it("detects headers below merged/blank title cells, reports unknown columns, ignores blank rows and preserves numeric phones", async () => {
  const result = await parseCustomerWorkbook(
    await workbook([
      ["Tên khách hàng"],
      [null, null],
      [null, " TÊN KHÁCH HÀNG ", "Điện thoại", "Email", "VAT", "Loại", "Khác"],
      [null, "CTY Một", 912345678, "explicit@example.test", 5, "", "ignored"],
      [],
      [null, "NXB Hai", "0900000000", "", null, "", null],
    ]),
    { extraFields: [] },
  );
  expect(result.rows).toHaveLength(2);
  expect(result.rows[0]).toMatchObject({
    row: 4,
    fields: {
      name: "CTY Một",
      phone: "0912345678",
      email: "explicit@example.test",
      vatRate: 5,
      kind: "company",
    },
  });
  expect(result.rows[1].fields).toMatchObject({ vatRate: 8, kind: "bookstore" });
  expect(result.unknownColumns).toEqual(["Khác"]);
});
it("reports VAT, kind, missing name, invalid contact and extra cell errors without dropping rows", async () => {
  const fields = {
    extraFields: [
      { key: "points", label: "Điểm", type: "number" as const },
      { key: "vip", label: "Ưu tiên", type: "boolean" as const },
    ],
  };
  const result = await parseCustomerWorkbook(
    await workbook([
      ["Tên", "VAT", "Loại khách", "Email", "Điện thoại", "Điểm", "Ưu tiên"],
      ["", "perhaps", "bad", "bad", "1".repeat(51), "bad", "bad"],
    ]),
    fields,
  );
  expect(result.rows).toHaveLength(1);
  expect(result.errors.map((e) => e.field)).toEqual(
    expect.arrayContaining([
      "name",
      "vatRate",
      "kind",
      "email",
      "phone",
      "extra.points",
      "extra.vip",
    ]),
  );
});
it("does not replace explicit contact columns with extracted notes contacts", async () => {
  const result = await parseCustomerWorkbook(
    await workbook([
      ["Tên", "Điện thoại", "Email", "Thông tin"],
      ["Khách", "0900111222", "first@example.test", "second@example.test 0966993407"],
    ]),
    { extraFields: [] },
  );
  expect(result.rows[0].fields).toMatchObject({
    phone: "0900111222",
    email: "first@example.test",
    kind: "individual",
  });
});
it("rejects unsupported, oversized, corrupt, missing-header and >1000-row files clearly", async () => {
  for (const file of [
    await workbook([["Tên"], ["A"]], "data.csv"),
    new File([new Uint8Array(2097153)], "big.xlsx"),
    new File(["bad"], "bad.xlsx"),
  ])
    await expect(parseCustomerWorkbook(file, { extraFields: [] })).rejects.toThrow();
  await expect(
    parseCustomerWorkbook(await workbook([["Unknown"], ["Data"]]), { extraFields: [] }),
  ).rejects.toThrow("Không tìm thấy dòng tiêu đề");
  await expect(
    parseCustomerWorkbook(
      await workbook([["Tên"], ...Array.from({ length: 1001 }, (_, i) => ["A" + i])]),
      { extraFields: [] },
    ),
  ).rejects.toThrow("1.000");
});
it("generates a sample from fixed and site headers that parses back with typed extras", async () => {
  const config = {
    extraFields: [
      { key: "points", label: "Điểm", type: "number" as const, importHeaders: ["Points"] },
      { key: "vip", label: "Ưu tiên", type: "boolean" as const },
    ],
  };
  const blob = await customerSampleWorkbook(config);
  const result = await parseCustomerWorkbook(new File([blob], "sample.xlsx"), config);
  expect(result.rows).toHaveLength(1);
  expect(result.errors).toEqual([]);
  expect(result.rows[0].fields.extra).toMatchObject({ points: 0, vip: false });
});
