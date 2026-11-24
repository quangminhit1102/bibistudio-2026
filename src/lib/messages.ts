// Texts of the public interface, read from the active site.
import { messages } from "@/platform/site";
import type { MessageKey } from "@/platform/site-contract";

type Values = Record<string, string | number>;

/** Replaces each `{name}` that has a value; a placeholder without one is kept. */
export function fill(text: string, values: Values = {}): string {
  return text.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : placeholder,
  );
}

export const t = (key: MessageKey, values?: Values): string => fill(messages[key], values);
