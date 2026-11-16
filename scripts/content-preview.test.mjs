import test from "node:test";
import assert from "node:assert/strict";
import { createContentE2eFixture } from "../tests/e2e/helpers/content-fixture.mjs";
import { assertPortsFree } from "./process-group.mjs";
test(
  "compiled preview serves article HTML before browser JavaScript",
  { timeout: 120000 },
  async (t) => {
    const fixture = await createContentE2eFixture(t, { mode: "bridge" });
    const post = await fixture.createPost({ slug: "new-article", title: "Bài đã đăng" });
    await fixture.publish(post);
    const response = await fetch(fixture.baseUrl + "/blog/new-article");
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /<h1[^>]*>Bài đã đăng<\/h1>/);
    assert.doesNotMatch(html, /id="root"/);
    assert.equal((await fetch(fixture.baseUrl + "/blog/not-published")).status, 404);
    assert.equal((await fetch(fixture.baseUrl + "/%62log/new-article")).status, 404);
    assert.equal((await fetch(fixture.baseUrl + "/api/health")).status, 200);
    const headers = { Authorization: "Bearer " + (await fixture.login()) };
    assert.equal(
      (await fetch(fixture.baseUrl + "/api/content/posts", { method: "POST", headers })).status,
      503,
    );
    const ownedPorts = [...fixture.ownedPorts];
    await fixture.close();
    await fixture.close();
    await assertPortsFree(ownedPorts);
  },
);
