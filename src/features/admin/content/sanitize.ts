import type { JSONContent } from "@tiptap/react";
const allowed = new Set([
  "doc",
  "paragraph",
  "text",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "codeBlock",
  "hardBreak",
  "horizontalRule",
  "image",
]);
export function safeDocument(raw: string): JSONContent {
  try {
    const root = JSON.parse(raw) as JSONContent;
    function clean(node: JSONContent): JSONContent | null {
      if (!node.type || !allowed.has(node.type)) return null;
      if (node.type === "text")
        return {
          type: "text",
          text: String(node.text ?? ""),
          marks: node.marks
            ?.filter(
              (m) =>
                ["bold", "italic", "strike", "code", "underline", "link"].includes(m.type) &&
                (m.type !== "link" || /^(https?:|mailto:)/i.test(String(m.attrs?.href))),
            )
            .map((m) =>
              m.type === "link"
                ? {
                    type: m.type,
                    attrs: {
                      href: String(m.attrs?.href),
                      target: "_blank",
                      rel: "noopener noreferrer",
                    },
                  }
                : { type: m.type },
            ),
        };
      if (node.type === "image") {
        const id = node.attrs?.mediaId;
        return typeof id === "string"
          ? {
              type: "image",
              attrs: {
                mediaId: id,
                src: "bibi-media:" + id,
                alt: String(node.attrs?.alt ?? "Ảnh bài viết"),
              },
            }
          : null;
      }
      return {
        type: node.type,
        ...(node.type === "heading"
          ? {
              attrs: {
                level: [1, 2, 3].includes(Number(node.attrs?.level))
                  ? Number(node.attrs?.level)
                  : 2,
              },
            }
          : {}),
        content: node.content?.map(clean).filter((n): n is JSONContent => n !== null),
      };
    }
    const result = clean(root);
    return result?.type === "doc" ? result : { type: "doc", content: [{ type: "paragraph" }] };
  } catch {
    return {
      type: "doc",
      content: [{ type: "paragraph", content: raw ? [{ type: "text", text: raw }] : [] }],
    };
  }
}
