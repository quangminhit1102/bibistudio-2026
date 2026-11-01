import assert from "node:assert/strict";
import { test } from "node:test";
import { lensGeometry } from "../src/lib/magnifier-geometry.ts";

test("magnifies the displayed image 3x and keeps its center under the pointer", () => {
  assert.deepEqual(lensGeometry(250, 250, 500, 500, 1000, 500, 176), {
    left: 250,
    top: 250,
    bgW: 1500,
    bgH: 750,
    bgX: -662,
    bgY: -287,
  });
});

test("maps an off-center point through horizontal letterboxing", () => {
  assert.deepEqual(lensGeometry(200, 250, 800, 1000, 1000, 2000, 176), {
    left: 200,
    top: 250,
    bgW: 1500,
    bgH: 3000,
    bgX: -62,
    bgY: -662,
  });
  assert.equal(lensGeometry(100, 250, 800, 1000, 1000, 2000, 176), null);
  assert.equal(lensGeometry(250, 50, 500, 500, 1000, 500, 176), null);
});

test("recomputes zoom from resized display dimensions", () => {
  const large = lensGeometry(400, 500, 800, 1000, 1000, 2000, 176);
  const small = lensGeometry(200, 250, 400, 500, 1000, 2000, 176);
  assert.equal(small.bgW, large.bgW / 2);
  assert.equal(small.bgH, large.bgH / 2);
  assert.equal(small.bgX, 88 - small.bgW / 2);
  assert.equal(small.bgY, 88 - small.bgH / 2);
});

test("rejects unloaded images, invalid geometry and out-of-image pointers", () => {
  for (const value of [0, -1, NaN, Infinity]) {
    assert.equal(lensGeometry(100, 100, 500, 500, value, 500, 176), null);
    assert.equal(lensGeometry(100, 100, value, 500, 500, 500, 176), null);
  }
  assert.equal(lensGeometry(NaN, 100, 500, 500, 500, 500, 176), null);
  assert.equal(lensGeometry(-1, 100, 500, 500, 500, 500, 176), null);
  assert.equal(lensGeometry(501, 100, 500, 500, 500, 500, 176), null);
});
