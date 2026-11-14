import { parentPort, workerData } from "node:worker_threads";
import { JSDOM } from "jsdom";
import createDOMPurify from "dompurify";
import { CONTENT_LIMITS as L } from "./limits";
import {
  RICH_TAGS,
  RICH_ATTRIBUTES,
  serverMediaId,
  escapeContentHtml as escape,
  safeContentLink,
} from "./rich-policy";
import type { SanitizedContent } from "./contracts";
interface LegacyNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type?: string; attrs?: Record<string, unknown> }[];
  content?: LegacyNode[];
}
function legacyHtml(root: LegacyNode): string {
  let nodes = 0;
  const visit = (node: LegacyNode, depth: number): string => {
    if (++nodes > L.nodes || depth > L.depth) throw Error("CONTENT_COMPLEXITY");
    if (!node || typeof node !== "object") return "";
    if (node.type === "text") {
      let text = escape(String(node.text ?? ""));
      for (const mark of Array.isArray(node.marks) ? node.marks : []) {
        const tag: Record<string, string> = {
          bold: "strong",
          italic: "em",
          underline: "u",
          strike: "s",
          code: "code",
        };
        if (tag[mark.type ?? ""]) text = `<${tag[mark.type!]}>${text}</${tag[mark.type!]}>`;
        else if (mark.type === "link" && safeContentLink(String(mark.attrs?.href ?? "")))
          text = `<a href="${escape(String(mark.attrs?.href))}">${text}</a>`;
      }
      return text;
    }
    if (node.type === "image") {
      const id = String(node.attrs?.mediaId ?? "");
      return serverMediaId(id)
        ? `<img data-media-id="${id}" alt="${escape(String(node.attrs?.alt ?? ""))}">`
        : "";
    }
    if (node.type === "hardBreak") return "<br>";
    if (node.type === "horizontalRule") return "<hr>";
    const children = (Array.isArray(node.content) ? node.content : [])
      .map((child) => visit(child, depth + 1))
      .join("");
    if (node.type === "doc") return children;
    const tags: Record<string, string> = {
      paragraph: "p",
      bulletList: "ul",
      orderedList: "ol",
      listItem: "li",
      blockquote: "blockquote",
      codeBlock: "pre",
    };
    const tag =
      node.type === "heading"
        ? `h${[1, 2, 3, 4].includes(Number(node.attrs?.level)) ? Number(node.attrs?.level) : 2}`
        : tags[node.type ?? ""];
    return tag ? `<${tag}>${children}</${tag}>` : "";
  };
  return visit(root, 1);
}
function rawHtml(raw: string): string {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    /* unstructured text is always escaped */
  }
  if (value && typeof value === "object") {
    const doc = value as Record<string, unknown>;
    if (doc.format === "html-v1" && typeof doc.html === "string") return doc.html;
    if (doc.type === "doc" && Array.isArray(doc.content)) return legacyHtml(doc as LegacyNode);
  }
  return `<p>${escape(raw).replace(/\r?\n/g, "<br>")}</p>`;
}
function assertComplexity(root: Node) {
  let nodes = 0;
  const pending: [Node, number][] = [[root, 0]];
  while (pending.length) {
    const [node, depth] = pending.pop()!;
    if (++nodes > L.nodes || depth > L.depth) throw Error("CONTENT_COMPLEXITY");
    for (const child of Array.from(node.childNodes)) pending.push([child, depth + 1]);
  }
}
function sanitize(raw: string): SanitizedContent {
  const window = new JSDOM("").window;
  try {
    const source = rawHtml(raw),
      template = window.document.createElement("template");
    template.innerHTML = source;
    assertComplexity(template.content);
    const fragment = createDOMPurify(window).sanitize(source, {
      ALLOWED_TAGS: RICH_TAGS,
      ALLOWED_ATTR: RICH_ATTRIBUTES,
      ALLOW_DATA_ATTR: false,
      RETURN_DOM_FRAGMENT: true,
    });
    const mediaIds = new Set<string>();
    for (let element of Array.from(fragment.querySelectorAll<HTMLElement>("*"))) {
      if (element.tagName === "H1") {
        const heading = window.document.createElement("h2");
        heading.append(...element.childNodes);
        for (const attribute of Array.from(element.attributes))
          heading.setAttribute(attribute.name, attribute.value);
        element.replaceWith(heading);
        element = heading;
      }
      const style = element.style,
        styles: string[] = [];
      for (const property of ["color", "background-color"]) {
        const color = style.getPropertyValue(property).trim();
        if (/^(#[\da-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%]+\)|[a-z]+)$/i.test(color))
          styles.push(`${property}: ${color};`);
      }
      if (["left", "center", "right", "justify"].includes(style.textAlign))
        styles.push(`text-align: ${style.textAlign};`);
      if (/^(0|[1-9]\d{0,2})px$/.test(style.paddingLeft) && parseFloat(style.paddingLeft) <= 240)
        styles.push(`padding-left: ${style.paddingLeft};`);
      const decoration = style.textDecorationLine || style.textDecoration;
      for (const [name, tag] of [
        ["underline", "u"],
        ["line-through", "s"],
      ])
        if (decoration.includes(name) && element.tagName !== tag.toUpperCase()) {
          const wrapper = window.document.createElement(tag);
          wrapper.append(...element.childNodes);
          element.append(wrapper);
        }
      if (["TABLE", "COL", "TH", "TD"].includes(element.tagName)) {
        const width = style.width;
        if (
          (/^\d+(\.\d+)?%$/.test(width) && parseFloat(width) > 0 && parseFloat(width) <= 100) ||
          (/^\d+(\.\d+)?px$/.test(width) && parseFloat(width) > 0 && parseFloat(width) <= 1600)
        )
          styles.push(`width: ${width};`);
        if (["top", "middle", "bottom"].includes(style.verticalAlign))
          styles.push(`vertical-align: ${style.verticalAlign};`);
      }
      const imageWidth = style.width;
      element.removeAttribute("style");
      if (styles.length) element.setAttribute("style", styles.join(" "));
      for (const attribute of ["colspan", "rowspan"]) {
        const count = Number(element.getAttribute(attribute));
        if (
          !["TH", "TD"].includes(element.tagName) ||
          !Number.isInteger(count) ||
          count < 1 ||
          count > 100
        )
          element.removeAttribute(attribute);
      }
      if (
        element.tagName !== "TH" ||
        !["row", "col", "rowgroup", "colgroup"].includes(element.getAttribute("scope") ?? "")
      )
        element.removeAttribute("scope");
      if (
        element.tagName !== "TABLE" ||
        !/^\d$/.test(element.getAttribute("border") ?? "") ||
        Number(element.getAttribute("border")) > 5
      )
        element.removeAttribute("border");
      if (element.tagName === "A") {
        if (!safeContentLink(element.getAttribute("href") ?? "")) element.removeAttribute("href");
        if (element.getAttribute("target") === "_blank")
          element.setAttribute("rel", "noopener noreferrer");
        else {
          element.removeAttribute("target");
          element.removeAttribute("rel");
        }
      }
      if (element.tagName === "IMG") {
        const id = element.getAttribute("data-media-id") ?? "";
        if (!serverMediaId(id)) {
          element.remove();
          continue;
        }
        mediaIds.add(id);
        element.setAttribute("src", `bibi-media:${id}`);
        const width = /^\d+(\.\d+)?px$/.test(imageWidth)
          ? parseFloat(imageWidth)
          : Number(element.getAttribute("width"));
        if (Number.isFinite(width) && width >= 16 && width <= 4096)
          element.setAttribute("width", String(Math.round(width)));
        else element.removeAttribute("width");
      } else {
        element.removeAttribute("width");
        element.removeAttribute("data-media-id");
      }
    }
    assertComplexity(fragment);
    const holder = window.document.createElement("div");
    holder.append(fragment);
    const html = holder.innerHTML;
    if (Buffer.byteLength(html) > L.bodyBytes) throw Error("CONTENT_TOO_LARGE");
    for (const block of Array.from(
      holder.querySelectorAll("p,h2,h3,h4,li,blockquote,br,figcaption,th,td"),
    ))
      block.append(" ");
    return {
      content: JSON.stringify({ format: "html-v1", html }),
      html,
      plainText: (holder.textContent ?? "").replace(/\s+/g, " ").trim(),
      mediaIds: [...mediaIds],
    };
  } finally {
    window.close();
  }
}
try {
  parentPort?.postMessage({ value: sanitize(workerData) });
} catch (error) {
  const code =
    error instanceof Error && ["CONTENT_COMPLEXITY", "CONTENT_TOO_LARGE"].includes(error.message)
      ? error.message
      : "INVALID_CONTENT";
  parentPort?.postMessage({ error: code });
}
