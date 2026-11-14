/** Pure editor policy, safe to import from the browser without Node dependencies. */
export const RICH_TAGS = [
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
];
export const RICH_ATTRIBUTES = [
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
];
export const serverMediaId = (value: string) =>
  /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(value);
export const escapeContentHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
export const safeContentLink = (url: string) =>
  ![...url].some((c) => c === "\\" || c.charCodeAt(0) <= 32) &&
  (/^(https?:\/\/|mailto:)/i.test(url) || /^\/(?!\/)/.test(url));
