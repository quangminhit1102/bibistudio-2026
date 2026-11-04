import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import jwt from "../node_modules/jsonwebtoken/index.js";
import { verifyAccess } from "../dist/auth/tokens.js";

test("JWT verifies algorithm/issuer/audience, mandatory15minute expiry and bounded identity claims", () => {
  const config = {
    jwtSecret: randomBytes(32).toString("hex"),
    jwtIssuer: "test-api",
    jwtAudience: "test-admin",
  };
  const clock = { now: () => new Date("2026-11-04T00:00:00Z") };
  const seconds = +clock.now() / 1000;
  const claims = {
    sub: randomUUID(),
    sid: randomUUID(),
    authVersion: 1,
    iss: config.jwtIssuer,
    aud: config.jwtAudience,
    iat: seconds,
    exp: seconds + 900,
  };
  const sign = (patch = {}, algorithm = "HS256") =>
    jwt.sign(
      Object.fromEntries(
        Object.entries({ ...claims, ...patch }).filter(([, value]) => value !== undefined),
      ),
      config.jwtSecret,
      { algorithm },
    );
  assert.equal(verifyAccess(sign(), config, clock).sub, claims.sub);
  for (const token of [
    sign({}, "HS384"),
    sign({ iss: "other" }),
    sign({ aud: "other" }),
    sign({ exp: undefined }),
    sign({ exp: seconds + 1800 }),
    sign({ exp: seconds - 1 }),
    sign({ sid: "" }),
    sign({ sub: "a".repeat(5000) }),
    sign({ authVersion: 0 }),
  ])
    assert.throws(
      () => verifyAccess(token, config, clock),
      (error) => error.status === 401,
    );
});
