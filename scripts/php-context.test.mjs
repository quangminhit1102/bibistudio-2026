import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { createHmac, createHash } from "node:crypto";
const image = "php:8.4-cli@sha256:d63e8b80cd4c6cfd01cfa7c910522e299cdc7ca1a2b6d6563db48df3c17e6c55";
function php(action, input) {
  const code = `require '/relay/context.php';$i=json_decode(stream_get_contents(STDIN),true);try{$r=${action};echo json_encode(['ok'=>true,'value'=>$r]);}catch(Throwable $e){echo json_encode(['ok'=>false,'status'=>$e instanceof BibiRelayError?$e->status:500]);}`;
  const r = spawnSync(
    "docker",
    [
      ...(process.env.DOCKER_CONTEXT
        ? ["--context", process.env.DOCKER_CONTEXT]
        : process.platform === "win32"
          ? ["--context", "desktop-linux"]
          : []),
      "run",
      "--rm",
      "-i",
      "--network",
      "none",
      "--read-only",
      "--cap-drop",
      "ALL",
      "--security-opt",
      "no-new-privileges",
      "--mount",
      `type=bind,source=${resolve("backend/relay")},target=/relay,readonly`,
      image,
      "php",
      "-r",
      code,
    ],
    { input: JSON.stringify(input), encoding: "utf8", windowsHide: true, timeout: 20000 },
  );
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}
const secret = Buffer.alloc(32, 7).toString("base64url"),
  sha = (s) => createHash("sha256").update(s).digest("hex");
test("actual PHP canonical envelope equals independently calculated Node bytes", () => {
  const fields = {
    timestamp: 1794528000,
    requestId: "a".repeat(32),
    bodySha256: sha("{}"),
    ip: "8.8.8.8",
    origin: "https://bibistudio.vn",
    cookieSha256: sha("anonymous-only"),
    userAgent: "Browser tiếng Việt",
    dnt: false,
    gpc: true,
  };
  const raw = [
    "bibi-analytics-v1",
    fields.timestamp,
    fields.requestId,
    "POST",
    "/api/analytics/collect",
    fields.bodySha256,
    fields.ip,
    Buffer.from(fields.origin).toString("base64url"),
    fields.cookieSha256,
    Buffer.from(fields.userAgent).toString("base64url"),
    "0",
    "1",
    "",
  ].join("\n");
  assert.deepEqual(php("bibi_relay_envelope($i['fields'],$i['secret'])", { fields, secret }), {
    ok: true,
    value: {
      context: Buffer.from(raw).toString("base64url"),
      signature: createHmac("sha256", Buffer.from(secret, "base64url")).update(raw).digest("hex"),
    },
  });
});
test("PHP normalizes mapped IPv4 and rejects nonpublic IP, cookie ambiguity, forwarding variants", () => {
  assert.deepEqual(php("bibi_relay_public_ip($i)", "::ffff:8.8.8.8"), {
    ok: true,
    value: "8.8.8.8",
  });
  for (const ip of ["127.0.0.1", "::1", "192.0.2.1", "bad"])
    assert.equal(php("bibi_relay_public_ip($i)", ip).value, null);
  assert.equal(
    php("bibi_relay_cookie($i)", "auth=private; bibi_visitor=abc; bibi_visitor=abc").value,
    "abc",
  );
  assert.equal(php("bibi_relay_cookie($i)", "bibi_visitor=abc; bibi_visitor=other").ok, false);
  for (const name of [
    "X-Forwarded-For",
    "x_real_ip",
    "Forwarded",
    "CF-Connecting-IP",
    "Client-IP",
    "True-Client-IP",
    "X-Cluster-Client-IP",
    "!~Passenger-Client-Address",
  ])
    assert.deepEqual(php("bibi_relay_reject_headers($i)", { [name]: "198.51.100.77" }), {
      ok: false,
      status: 403,
    });
});

test("PHP special ranges agree with the Node public-address boundary", () => {
  const ranges = [
    "192.88.99.1",
    "192.175.48.1",
    "192.31.196.1",
    "192.52.193.1",
    "fec0::1",
    "100::1",
    "::ffff:0:8.8.8.8",
    "64:ff9b::808:808",
    "64:ff9b:1::1",
    "2002:808:808::1",
    "2620:4f:8000::1",
    "5f00::1",
    "3fff::1",
  ];
  assert.deepEqual(php("array_map('bibi_relay_public_ip',$i)", ranges), {
    ok: true,
    value: ranges.map(() => null),
  });
});
