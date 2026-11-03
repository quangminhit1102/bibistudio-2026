import DOMPurify from "dompurify";

export interface LegacyNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: LegacyNode[];
}
export const validMediaId = (id: string) => /^[a-zA-Z0-9_-]{1,200}$/.test(id);
export function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
const safeLink = (url: string) =>
  /^(https?:\/\/|mailto:)/i.test(url) ||
  (/^\/(?!\/)/.test(url) && ![...url].some((c) => c === "\\" || c.charCodeAt(0) <= 32));

function legacyHtml(node: LegacyNode, depth = 0): string {
  if (depth > 100 || !node || typeof node !== "object") return "";
  if (node.type === "text") {
    let text = escapeHtml(String(node.text ?? ""));
    for (const mark of node.marks ?? []) {
      const tag = (
        { bold: "strong", italic: "em", underline: "u", strike: "s", code: "code" } as Record<
          string,
          string
        >
      )[mark.type];
      if (tag) text = `<${tag}>${text}</${tag}>`;
      else if (mark.type === "link" && safeLink(String(mark.attrs?.href ?? "")))
        text = `<a href="${escapeHtml(String(mark.attrs?.href))}" target="_blank">${text}</a>`;
    }
    return text;
  }
  if (node.type === "image") {
    const id = String(node.attrs?.mediaId ?? "");
    return validMediaId(id)
      ? `<img data-media-id="${id}" src="bibi-media:${id}" alt="${escapeHtml(String(node.attrs?.alt ?? "Ảnh bài viết"))}">`
      : "";
  }
  if (node.type === "hardBreak") return "<br>";
  if (node.type === "horizontalRule") return "<hr>";
  const children = (Array.isArray(node.content) ? node.content : [])
    .map((c) => legacyHtml(c, depth + 1))
    .join("");
  if (node.type === "doc") return children;
  const tag =
    node.type === "heading"
      ? `h${[1, 2, 3].includes(Number(node.attrs?.level)) ? Number(node.attrs?.level) : 2}`
      : (
          {
            paragraph: "p",
            bulletList: "ul",
            orderedList: "ol",
            listItem: "li",
            blockquote: "blockquote",
            codeBlock: "pre",
          } as Record<string, string>
        )[node.type ?? ""];
  return tag ? `<${tag}>${children}</${tag}>` : "";
}

/** Only durable media references survive. Runtime src values never reach storage. */
export function sanitizeRichHtml(html: string): string {
  const fragment = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p",
      "br",
      "h1",
      "h2",
      "h3",
      "h4",
      "sub",
      "sup",
      "table",
      "caption",
      "colgroup",
      "col",
      "thead",
      "tbody",
      "tfoot",
      "tr",
      "th",
      "td",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "strike",
      "ul",
      "ol",
      "li",
      "blockquote",
      "pre",
      "code",
      "hr",
      "a",
      "img",
      "figure",
      "figcaption",
      "span",
    ],
    ALLOWED_ATTR: [
      "href",
      "target",
      "rel",
      "alt",
      "title",
      "data-media-id",
      "style",
      "start",
      "width",
      "colspan",
      "rowspan",
      "scope",
      "border",
    ],
    ALLOW_DATA_ATTR: false,
    RETURN_DOM_FRAGMENT: true,
  });
  for (const element of fragment.querySelectorAll("*")) {
    const style = (element as HTMLElement).style;
    const alignment = style.textAlign;
    const styles: string[] = [];
    // Preserve only editor formatting; never arbitrary CSS or resource URLs.
    for (const property of ["color", "background-color"]) {
      const color = style.getPropertyValue(property).trim();
      if (/^(#[\da-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%]+\)|[a-z]+)$/i.test(color))
        styles.push(`${property}: ${color};`);
    }
    if (/^(0|[1-9]\d{0,2})px$/.test(style.paddingLeft) && parseFloat(style.paddingLeft) <= 240)
      styles.push(`padding-left: ${style.paddingLeft};`);
    const decoration =
      (element as HTMLElement).style.textDecorationLine ||
      (element as HTMLElement).style.textDecoration;
    if (decoration.includes("underline") && element.tagName !== "U") {
      const underline = document.createElement("u");
      underline.append(...element.childNodes);
      element.append(underline);
    }
    if (decoration.includes("line-through") && !["S", "STRIKE"].includes(element.tagName)) {
      const strike = document.createElement("s");
      strike.append(...element.childNodes);
      element.append(strike);
    }
    const width = style.width;
    const verticalAlign = style.verticalAlign;
    element.removeAttribute("style");
    if (["left", "center", "right", "justify"].includes(alignment))
      styles.push(`text-align: ${alignment};`);
    const tableElement = ["TABLE", "COL", "TH", "TD"].includes(element.tagName);
    if (tableElement) {
      if (
        (/^\d+(\.\d+)?%$/.test(width) && parseFloat(width) > 0 && parseFloat(width) <= 100) ||
        (/^\d+(\.\d+)?px$/.test(width) && parseFloat(width) > 0 && parseFloat(width) <= 1600)
      )
        styles.push(`width: ${width};`);
      if (["top", "middle", "bottom"].includes(verticalAlign))
        styles.push(`vertical-align: ${verticalAlign};`);
    }
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
    if (element.tagName !== "TABLE" || !/^[0-5]$/.test(element.getAttribute("border") ?? ""))
      element.removeAttribute("border");
    if (element.tagName !== "IMG") element.removeAttribute("width");
    if (element.tagName === "A") {
      if (!safeLink(element.getAttribute("href") ?? "")) element.removeAttribute("href");
      if (element.getAttribute("target") === "_blank")
        element.setAttribute("rel", "noopener noreferrer");
      else element.removeAttribute("target");
    }
    if (element.tagName === "IMG") {
      const size = /^\d+(\.\d+)?px$/.test(width)
        ? parseFloat(width)
        : Number(element.getAttribute("width"));
      if (Number.isFinite(size) && size >= 16 && size <= 4096)
        element.setAttribute("width", String(Math.round(size)));
      else element.removeAttribute("width");
      const id = element.getAttribute("data-media-id") ?? "";
      if (!validMediaId(id)) element.remove();
      else element.setAttribute("src", `bibi-media:${id}`);
    }
  }
  const holder = document.createElement("div");
  holder.append(fragment);
  return holder.innerHTML;
}

export function readRichContent(raw: string): string {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const doc = parsed as Record<string, unknown>;
      if (doc.format === "html-v1" && typeof doc.html === "string")
        return sanitizeRichHtml(doc.html);
      if (doc.type === "doc" && Array.isArray(doc.content))
        return sanitizeRichHtml(legacyHtml(doc as LegacyNode));
    }
  } catch {
    /* Legacy plain text. Never interpret it as HTML. */
  }
  return `<p>${escapeHtml(raw).replace(/\r?\n/g, "<br>")}</p>`;
}
export function writeRichContent(html: string): string {
  return JSON.stringify({ format: "html-v1", html: sanitizeRichHtml(html) });
}
export function richContentText(raw: string): string {
  const holder = document.createElement("div");
  holder.innerHTML = readRichContent(raw);
  for (const block of holder.querySelectorAll("p,h1,h2,h3,h4,li,blockquote,br,figcaption,th,td"))
    block.append(" ");
  return (holder.textContent ?? "").replace(/\s+/g, " ").trim();
}
