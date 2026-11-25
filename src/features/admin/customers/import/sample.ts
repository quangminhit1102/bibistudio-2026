import type { CustomerFieldConfig } from "@/platform/site-contract";
import { customerImportColumns } from "./parse";

export async function customerSampleWorkbook(config: CustomerFieldConfig): Promise<Blob> {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const columns = customerImportColumns(config);
  const example: Record<string, string | number> = {
    name: "Khách hàng mẫu",
    kind: "Cá nhân",
    address: "",
    phone: "0901234567",
    email: "khach@example.com",
    representative: "",
    vatRate: 8,
    notes: "",
  };
  return writeXlsxFile(
    [
      columns.map((f) => ({ value: f.importHeaders![0], fontWeight: "bold" as const })),
      columns.map((f) =>
        f.extraKey
          ? f.type === "number"
            ? 0
            : f.type === "checkbox"
              ? false
              : "Ví dụ"
          : (example[f.key] ?? ""),
      ),
    ],
    { sheet: "Khách hàng", columns: columns.map(() => ({ width: 24 })) },
  ).toBlob();
}
