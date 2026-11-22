import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { root } from "./runtime.mjs";

const template = await readFile(join(root, "ops/frontend.htaccess.template"), "utf8");
const header = (name) =>
  template.match(new RegExp(`^\\s*Header set ${name} "([^"]*)"\\s*$`, "m"))?.[1];

test("static responses carry the same baseline security headers as the API", () => {
  assert.equal(header("Strict-Transport-Security"), "max-age=31536000; includeSubDomains");
  assert.equal(header("X-Content-Type-Options"), "nosniff");
  assert.equal(header("Referrer-Policy"), "strict-origin-when-cross-origin");
});

test("the content security policy is report-only until it has been observed on hosting", () => {
  assert.equal(header("Content-Security-Policy"), undefined);
  const policy = header("Content-Security-Policy-Report-Only");
  assert.ok(policy, "report-only policy present");
  const directives = Object.fromEntries(
    policy.split(";").map((part) => {
      const [name, ...values] = part.trim().split(/\s+/);
      return [name, values];
    }),
  );
  assert.deepEqual(directives["default-src"], ["'self'"]);
  assert.deepEqual(directives["script-src"], ["'self'"]);
  assert.deepEqual(directives["object-src"], ["'none'"]);
  assert.deepEqual(directives["base-uri"], ["'self'"]);
  assert.deepEqual(directives["frame-ancestors"], ["'self'"]);
});

test("security headers are scoped to static files so API responses keep Helmet's own", () => {
  const blocks = [...template.matchAll(/<FilesMatch "([^"]+)">([\s\S]*?)<\/FilesMatch>/g)];
  const scoped = blocks.map(([, , body]) => body).join("\n");
  for (const line of template.split("\n").filter((l) => /^\s*Header set /.test(l)))
    assert.ok(scoped.includes(line.trim()), `${line.trim()} must sit inside a FilesMatch block`);
  const [, pattern] = blocks.find(([, , body]) => body.includes("X-Content-Type-Options"));
  const files = new RegExp(pattern);
  for (const name of ["index.html", "app-1a2b.js", "app.css", "version.json", "a.webp", "a.jpeg"])
    assert.ok(files.test(name), name);
  for (const name of ["collect.php", "health", "0b9c6f0e-6f6a-4c8e-9d55-0d6f0a4a9d55"])
    assert.ok(!files.test(name), name);
});

test("the release copy carries the same headers as the hosting template", async () => {
  // ops/ is installed on the server separately, so the copy inside the release is what
  // a normal deploy actually changes.
  const shipped = await readFile(join(root, "public/.htaccess"), "utf8");
  const headers = (text) =>
    text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^(?:Header set (?!Cache-Control)|<FilesMatch )/.test(line));
  const expected = headers(template).filter((line) => line !== '<FilesMatch "\\.(?:html|json)$">');
  assert.ok(expected.length >= 6);
  assert.deepEqual(headers(shipped), expected);
});
