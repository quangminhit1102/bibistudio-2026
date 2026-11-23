import { useQuery } from "@tanstack/react-query";
import { useAdmin } from "../../services/context";
import type { FormField, FormValues } from "./record-form";
import { relationResource } from "./relation-resource";

export type RelationSpec = Pick<FormField, "entity" | "filter" | "valueKey">;
export type Option = { value: string; label: string };

/** The records a relation field can point at; `valueKey` picks what is stored (default: id). */
export function useRelationOptions(spec: RelationSpec, scope = "options", enabled = true) {
  const runtime = useAdmin();
  return useQuery({
    enabled,
    queryKey: ["bibi-admin", scope, spec.entity, spec.filter, spec.valueKey],
    queryFn: async (): Promise<Option[]> => {
      await runtime.ensure(spec.entity!);
      const result = await runtime
        .service(spec.entity!, relationResource(spec))
        .list({ page: 1, pageSize: 500 });
      return result.items
        .filter((row) =>
          Object.entries(spec.filter ?? {}).every(([key, v]) => {
            const rowValue = (row as unknown as FormValues)[key];
            return rowValue === undefined || String(rowValue) === v;
          }),
        )
        .map((row) => ({
          value: spec.valueKey
            ? String((row as unknown as FormValues)[spec.valueKey] ?? row.id)
            : row.id,
          label: "name" in row ? String(row.name) : row.id,
        }));
    },
  });
}

/** A stored value that is no longer in the list stays selectable, under its own name. */
export function withStored(options: Option[], value: unknown): Option[] {
  const stored = (Array.isArray(value) ? value : [value]).filter(
    (v): v is string => typeof v === "string" && v !== "" && !options.some((o) => o.value === v),
  );
  return stored.length ? [...options, ...stored.map((v) => ({ value: v, label: v }))] : options;
}
