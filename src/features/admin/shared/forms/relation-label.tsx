import { useRelationOptions, type RelationSpec } from "./relation-options";

/** The name of the record a stored value points at; the value itself when there is none. */
export function RelationLabel({ spec, value }: { spec: RelationSpec; value: unknown }) {
  const options = useRelationOptions(spec);
  const stored = value == null ? "" : String(value);
  return <>{options.data?.find((o) => o.value === stored)?.label ?? stored}</>;
}
