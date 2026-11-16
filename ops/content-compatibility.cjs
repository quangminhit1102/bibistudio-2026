"use strict";
const { lstat } = require("node:fs/promises");
const { join } = require("node:path");
async function contentIsActive(config) {
  if (!config.root) return false;
  for (const name of ["private/content-routing.json", "content/active"]) {
    try {
      await lstat(join(config.root, name));
      return true;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return false;
}
async function assertContentCompatible(config, candidate) {
  if (!(await contentIsActive(config))) return;
  const m = candidate?.manifest,
    publicContract = m?.content ?? m?.contentPublic;
  if (publicContract?.readerVersion !== 1 || publicContract?.readModelVersion !== 1)
    throw Error("Content compatibility required after public cutover");
}
module.exports = { assertContentCompatible, contentIsActive };
