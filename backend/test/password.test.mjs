import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../dist/auth/password.js";

test("password hash is salted bcrypt12 and verifies only the correct password", async () => {
  const password = "test-only-Pass!809";
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.match(first, /^\$2[aby]\$12\$/);
  assert.notEqual(first, password);
  assert.notEqual(first, second);
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword("wrong", first), false);
});

test("bcrypt does not silently truncate passwords beyond 72 UTF-8 bytes", async () => {
  const exact = "á".repeat(36);
  const hash = await hashPassword(exact);
  assert.equal(await verifyPassword(exact, hash), true);
  await assert.rejects(hashPassword(exact + "a"), /72/);
  assert.equal(await verifyPassword(exact + "a", hash), false);
});
