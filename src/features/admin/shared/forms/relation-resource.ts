import type { Resource } from "../../services/contracts";
import type { FormField } from "./record-form";
export function relationResource(
  field: Pick<FormField, "entity" | "filter">,
): Resource | undefined {
  if (field.entity !== "categories") return undefined;
  const kind = field.filter?.kind;
  return kind === "content" ? "content" : kind === "genre" ? "bookstore" : "products";
}
