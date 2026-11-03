import { expect, it } from "vitest";
import {
  readRichContent,
  writeRichContent,
  richContentText,
} from "../../src/features/admin/content/rich-content";

it("round trips blog headings, marks, colors and indentation", () => {
  const raw = writeRichContent(
    '<h4>Chi tiết</h4><p style="padding-left: 40px"><span style="color: #ab1234; background-color: #fff1aa; text-decoration: line-through">Nội dung</span> H<sub>2</sub>O m<sup>2</sup></p><hr>',
  );
  const html = readRichContent(raw);
  expect(html).toContain("<h4>Chi tiết</h4>");
  expect(html).toContain("padding-left: 40px");
  expect(html).toContain("color: rgb(171, 18, 52)");
  expect(html).toContain("background-color: rgb(255, 241, 170)");
  expect(html).toContain("<s>Nội dung</s>");
  expect(html).toContain("<sub>2</sub>");
  expect(html).toContain("<sup>2</sup>");
  expect(writeRichContent(html)).toBe(raw);
});
it("keeps table structure, bounded cell spans and image width across reload", () => {
  const raw = writeRichContent(
    '<table style="width:100%;border-collapse:collapse" border="1"><thead><tr><th colspan="2">Thông số</th></tr></thead><tbody><tr><td>Số trang</td><td>120</td></tr></tbody></table><figure><img data-media-id="asset-1" src="blob:temp" style="width: 320px; height: 900px" alt="Sổ"><figcaption>Bìa sổ</figcaption></figure>',
  );
  const html = readRichContent(raw);
  expect(html).toContain("<table");
  expect(html).toContain('<th colspan="2">');
  expect(html).toContain("<td>120</td>");
  expect(html).toContain('width="320"');
  expect(html).not.toContain("900px");
  expect(html).not.toContain("blob:");
  expect(richContentText(raw)).toContain("Số trang 120");
  expect(writeRichContent(html)).toBe(raw);
});
it("rejects layout injection, remote resources and out-of-range dimensions", () => {
  const html = readRichContent(
    writeRichContent(
      '<p style="position:fixed;z-index:999;color:url(https://evil.test);background-image:url(https://evil.test);padding-left:99999px">Text</p><img data-media-id="asset-1" width="999999" height="-1" style="width:999999px;float:left" onerror="alert(1)"><table><tr><td colspan="99999" style="width:999999px">Cell</td></tr></table>',
    ),
  );
  expect(html).not.toMatch(/position|z-index|evil|99999|onerror|float|height=/);
});
