import { readRichContent } from "../../content/rich-content";
import type { FormValues } from "./record-form";

function richFingerprint(raw: unknown): string {
  const holder = document.createElement("div");
  holder.innerHTML = readRichContent(typeof raw === "string" ? raw : "");
  for (const [from, to] of [
    ["b", "strong"],
    ["i", "em"],
  ]) {
    for (const old of holder.querySelectorAll(from)) {
      const replacement = document.createElement(to);
      for (const attribute of old.attributes)
        replacement.setAttribute(attribute.name, attribute.value);
      replacement.append(...old.childNodes);
      old.replaceWith(replacement);
    }
  }
  const html = holder.innerHTML;
  return /^(?:\s|<p(?:\s[^>]*)?>|<\/p>|<br\s*\/?>)*$/.test(html) ? "" : html;
}
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, stable(v)]),
    );
  return value;
}
export function formFingerprint(kind: "post" | "product", values: FormValues): string {
  const body = kind === "post" ? "content" : "description";
  return JSON.stringify(
    stable({ ...values, slug: values.slug ?? "", [body]: richFingerprint(values[body]) }),
  );
}
export function hasFormChanges(
  kind: "post" | "product",
  baseline: FormValues,
  current: FormValues,
): boolean {
  return formFingerprint(kind, baseline) !== formFingerprint(kind, current);
}
