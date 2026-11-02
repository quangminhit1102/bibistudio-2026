import baseline from "./legacy-presentation.json";
import type { EntityKey } from "../services/contracts";
export function legacyPresentationBaseline(
  entity: EntityKey,
  id: string,
): Readonly<Record<string, unknown>> | undefined {
  return (baseline as Record<string, Record<string, Record<string, unknown>>>)[entity]?.[id];
}
