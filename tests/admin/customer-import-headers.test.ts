import { expect, it } from "vitest";
import { defineCustomers } from "../../src/platform/site-contract";
import { customerSampleWorkbook } from "../../src/features/admin/customers/import/sample";
import { parseCustomerWorkbook } from "../../src/features/admin/customers/import/parse";

it.each([
  [{ key: "other", label: " EMAIL ", type: "text" as const }],
  [{ key: "other", label: "Other", type: "text" as const, importHeaders: [" TÊN   khách "] }],
  [
    { key: "a", label: "Region", type: "text" as const },
    { key: "b", label: " region ", type: "text" as const },
  ],
  [
    { key: "a", label: "A", type: "text" as const, importHeaders: ["Region"] },
    { key: "b", label: "B", type: "text" as const, importHeaders: ["REGION"] },
  ],
  [{ key: "a", label: "Region", type: "text" as const, importHeaders: [" region "] }],
])("rejects ambiguous customer import headers: %j", (...extraFields) => {
  expect(() => defineCustomers({ extraFields })).toThrow(/customer.*header.*collision/i);
});

it("round-trips a sample with distinct configured labels and aliases", async () => {
  const config = defineCustomers({
    extraFields: [{ key: "region", label: "Region", type: "text", importHeaders: ["Area"] }],
  });
  const blob = await customerSampleWorkbook(config);
  const result = await parseCustomerWorkbook(new File([blob], "sample.xlsx"), config);
  expect(result.errors).toEqual([]);
  expect(result.rows[0].fields.extra?.region).toBe("Ví dụ");
  expect(defineCustomers({ extraFields: [] }).extraFields).toEqual([]);
});
