import { readRichContent } from "../../content/rich-content";
import type { FormValues } from "./record-form";
import { calendarDate } from "../lib/text";

const blockTags = new Set([
  "P",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "BLOCKQUOTE",
  "PRE",
  "FIGURE",
  "FIGCAPTION",
  "UL",
  "OL",
  "LI",
  "TABLE",
  "THEAD",
  "TBODY",
  "TFOOT",
  "TR",
  "TD",
  "TH",
  "HR",
]);

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
  // Attribute order is serializer metadata, not an edit (notably TinyMCE images).
  for (const element of holder.querySelectorAll("*")) {
    const attributes = [...element.attributes].map(({ name, value }) => [name, value]);
    attributes.sort(([a], [b]) => a.localeCompare(b));
    for (const [name] of attributes) element.removeAttribute(name);
    for (const [name, value] of attributes) element.setAttribute(name, value);
  }
  // TinyMCE indents block boundaries on serialization. These nodes have no
  // visible meaning; spaces between inline elements and inside pre/code do.
  const walker = document.createTreeWalker(holder, NodeFilter.SHOW_TEXT);
  const indentation: Node[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const boundary = (sibling: ChildNode | null) =>
      sibling instanceof Element && blockTags.has(sibling.tagName);
    if (
      /^\s+$/.test(node.textContent ?? "") &&
      !node.parentElement?.closest("pre,code") &&
      (boundary(node.previousSibling) || boundary(node.nextSibling))
    )
      indentation.push(node);
  }
  for (const node of indentation) node.parentNode?.removeChild(node);
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
  const date = values.publishAt;
  const publishAt =
    typeof date === "string" && date && Number.isNaN(Date.parse(date)) ? date : calendarDate(date);
  return JSON.stringify(
    stable({
      ...values,
      ...(kind === "post" ? { publishAt } : {}),
      slug: values.slug ?? "",
      [body]: richFingerprint(values[body]),
    }),
  );
}
export function hasFormChanges(
  kind: "post" | "product",
  baseline: FormValues,
  current: FormValues,
): boolean {
  return formFingerprint(kind, baseline) !== formFingerprint(kind, current);
}
