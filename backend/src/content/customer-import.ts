import { z } from "zod/v4";
import type { CustomerInput } from "./service";

export const normalizeName = (s: string): string => s.trim().replace(/\s+/g, " ").toLowerCase();
export const phoneDigits = (s: string): string => s.replace(/\D/g, "");
export const normalizeEmail = (s: string): string => s.trim().toLowerCase();

type DuplicateFields = { name?: string | null; phone?: string | null; email?: string | null };
export function duplicateKeys(
  a: DuplicateFields,
  b: DuplicateFields,
): ("name" | "phone" | "email")[] {
  const by: ("name" | "phone" | "email")[] = [];
  for (const [key, normalize] of [
    ["name", normalizeName],
    ["phone", phoneDigits],
    ["email", normalizeEmail],
  ] as const) {
    const value = normalize(typeof a[key] === "string" ? a[key] : "");
    if (value && value === normalize(typeof b[key] === "string" ? b[key] : "")) by.push(key);
  }
  return by;
}

export function inferKind(name: string): string {
  const normalized = normalizeName(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (/cong ty|cty|tnhh|co phan/.test(normalized)) return "company";
  if (/nha sach|nxb/.test(normalized)) return "bookstore";
  return "individual";
}

export const customerExtra = z
  .record(
    z.string().min(1).max(64),
    z.union([z.string().max(500), z.number().finite(), z.boolean(), z.null()]),
  )
  .refine((value) => Object.keys(value).length <= 30);

const importFields = z
  .object({
    name: z.string().trim().min(1).max(255),
    kind: z.enum(["company", "bookstore", "individual"]),
    address: z.string().nullable().optional(),
    phone: z.string().max(50).nullable().optional(),
    email: z.email().max(254).nullable().optional(),
    vatRate: z.number().min(0).max(100).optional(),
    notes: z.string().nullable().optional(),
    active: z.boolean().optional(),
    representative: z.string().max(255).nullable().optional(),
    extra: customerExtra.optional(),
  })
  .strict();

export interface ImportRow {
  row: number;
  action: "create" | "update" | "skip";
  targetId?: string;
  revision?: number;
  fields: Partial<CustomerInput>;
}
export interface ImportResult {
  rows: {
    row: number;
    status: "ok" | "error" | "duplicate";
    errors: { field: string; message: string }[];
    matches: { id: string; name: string; revision: number; by: ("name" | "phone" | "email")[] }[];
    inFile?: number;
  }[];
  created: number;
  updated: number;
  skipped: number;
  committed: boolean;
}

export function validateImportFields(fields: Partial<CustomerInput>, update: boolean) {
  const value: Record<string, unknown> = { ...fields };
  for (const key of ["address", "phone", "email", "representative", "notes", "vatRate"])
    if (typeof value[key] === "string" && !(value[key] as string).trim()) delete value[key];
  if (update) {
    for (const [key, cell] of Object.entries(value)) {
      if (cell == null || (typeof cell === "string" && !cell.trim())) delete value[key];
    }
    if (value.extra && typeof value.extra === "object" && !Array.isArray(value.extra))
      value.extra = Object.fromEntries(
        Object.entries(value.extra).filter(
          ([, cell]) => cell != null && (typeof cell !== "string" || cell.trim() !== ""),
        ),
      );
  } else if (
    (value.kind == null || (typeof value.kind === "string" && !value.kind.trim())) &&
    typeof value.name === "string"
  ) {
    value.kind = inferKind(value.name);
  }
  return (update ? importFields.partial() : importFields).safeParse(value);
}
