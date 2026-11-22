import { describe, expect, it } from "vitest";
import { renderArticle } from "../../src/lib/content-html";

describe("public article rendering", () => {
  it("resolves server-uploaded media ids to the public media endpoint", () => {
    const id = "e7c0da17-9dc1-486f-b706-f1e84fb2a67a";
    const raw = JSON.stringify({
      format: "html-v1",
      html: `<p>Văn bản</p><img data-media-id="${id}" src="bibi-media:${id}" alt="Ảnh">`,
    });
    const article = renderArticle(raw);
    expect(article.html).toContain(`src="/api/media/${id}"`);
    expect(article.html).not.toContain("bibi-media:");
  });

  it("drops legacy synthetic media ids instead of rendering broken images", () => {
    const raw = JSON.stringify({
      format: "html-v1",
      html: '<img data-media-id="journal-inline-demo-0" src="bibi-media:journal-inline-demo-0" alt="Sổ">',
    });
    const article = renderArticle(raw);
    expect(article.html).not.toContain("<img");
    expect(article.html).not.toContain("bibi-media:");
  });
});
