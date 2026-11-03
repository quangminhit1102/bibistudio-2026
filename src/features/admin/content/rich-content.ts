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
    ALLOWED_ATTR: ["href", "target", "rel", "alt", "title", "data-media-id", "style", "start"],
    ALLOW_DATA_ATTR: false,
    RETURN_DOM_FRAGMENT: true,
  });
  for (const element of fragment.querySelectorAll("*")) {
    const alignment = (element as HTMLElement).style.textAlign;
    const decoration =
      (element as HTMLElement).style.textDecorationLine ||
      (element as HTMLElement).style.textDecoration;
    if (decoration.includes("underline") && element.tagName !== "U") {
      const underline = document.createElement("u");
      underline.append(...element.childNodes);
      element.append(underline);
    }
    element.removeAttribute("style");
    if (["left", "center", "right", "justify"].includes(alignment))
      element.setAttribute("style", `text-align: ${alignment};`);
    if (element.tagName === "A") {
      if (!safeLink(element.getAttribute("href") ?? "")) element.removeAttribute("href");
      if (element.getAttribute("target") === "_blank")
        element.setAttribute("rel", "noopener noreferrer");
      else element.removeAttribute("target");
    }
    if (element.tagName === "IMG") {
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
  for (const block of holder.querySelectorAll("p,h1,h2,h3,li,blockquote,br,figcaption"))
    block.append(" ");
  return (holder.textContent ?? "").replace(/\s+/g, " ").trim();
}
