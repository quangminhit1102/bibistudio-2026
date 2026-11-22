import type { Resource } from "../../services/contracts";
import type { FormField } from "./record-form";
export function relationResource(field: FormField): Resource | undefined {
  if (field.entity !== "categories") return undefined;
  const kind = field.filter?.kind;
  return kind === "content" ? "content" : kind === "genre" ? "bookstore" : "products";
}
