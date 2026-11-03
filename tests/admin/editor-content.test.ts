import { describe, expect, it } from "vitest";
import {
  readRichContent,
  writeRichContent,
  richContentText,
} from "../../src/features/admin/content/rich-content";

describe("durable editor content", () => {
  it("preserves underline markup emitted by the TinyMCE formatter", () => {
    const html = readRichContent(
      writeRichContent(
        '<p><span style="text-decoration: underline; color:red">Gạch chân</span></p>',
      ),
    );
    expect(html).toContain("<u>Gạch chân</u>");
    expect(html).toContain("color: red");
  });
  it("treats legacy plain text and malformed JSON as text, not HTML", () => {
    expect(readRichContent("<script>literal</script>")).toBe(
      "<p>&lt;script&gt;literal&lt;/script&gt;</p>",
    );
    expect(richContentText("{broken")).toBe("{broken");
  });
  it("preserves legacy marks, headings, lists, quote and media references", () => {
    const raw = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Xin chào", marks: [{ type: "bold" }] }],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Một" }] }],
            },
          ],
        },
        {
          type: "blockquote",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Nhớ" }] }],
        },
        { type: "image", attrs: { mediaId: "asset-1", alt: "Sổ" } },
      ],
    });
    const html = readRichContent(raw);
    expect(html).toContain("<h2><strong>Xin chào</strong></h2>");
    expect(html).toContain("<ul><li><p>Một</p></li></ul>");
    expect(html).toContain("<blockquote><p>Nhớ</p></blockquote>");
    expect(html).toContain('data-media-id="asset-1"');
    expect(html).toContain('src="bibi-media:asset-1"');
  });
  it("round trips caption and allowed alignment without saving transient image URLs", () => {
    const raw = writeRichContent(
      '<h2 style="text-align: center; color:red">Tiêu đề</h2><figure><img data-media-id="asset-1" src="blob:temporary" alt="Sổ"><figcaption>Chú thích</figcaption></figure>',
    );
    expect(JSON.parse(raw).format).toBe("html-v1");
    const html = readRichContent(raw);
    expect(html).toContain("text-align: center");
    expect(html).toContain("color: red");
    expect(html).not.toContain("blob:");
    expect(html).toContain('src="bibi-media:asset-1"');
    expect(html).toContain("<figcaption>Chú thích</figcaption>");
    expect(writeRichContent(html)).toBe(raw);
  });
  it("removes executable content, arbitrary media, attributes and dangerous links", () => {
    const html = readRichContent(
      writeRichContent(
        '<script>alert(1)</script><iframe src="https://evil.test"></iframe><p onclick="x()" style="position:fixed">Nội dung</p><img src="https://evil.test/a"><img data-media-id="../evil" src="data:image/png;base64,aaaa"><a href="javascript:alert(1)">X</a><a href="https://example.com" target="_blank">Y</a>',
      ),
    );
    expect(html).not.toMatch(/script|iframe|onclick|position|<img|javascript|evil\.test/);
    expect(html).toContain("<p>Nội dung</p>");
    expect(html).toContain('rel="noopener noreferrer"');
    expect(richContentText(writeRichContent("<p>Một</p><p>Hai</p>"))).toBe("Một Hai");
  });
});
