import assert from "node:assert/strict";
import { test } from "node:test";

import {
  artifactEntries,
  getModeConfig,
  renderCpanelYml,
  toSafeWorkdirName,
} from "./cpanel-deploy-artifacts.mjs";

test("temp mode builds for the cPanel temporary URL", () => {
  assert.deepEqual(getModeConfig("temp"), {
    buildScript: "build:cpanel:temp",
    branch: "deploy/cpanel-temp",
    deployPath: "/home/vhplasti/public_html/",
  });
});

test("prod mode builds for a root domain", () => {
  assert.deepEqual(getModeConfig("prod"), {
    buildScript: "build:cpanel",
    branch: "deploy/cpanel-prod",
    deployPath: "/home/vhplasti/bibistudio.vn/",
  });
});

test("deployment manifest copies only generated static artifacts", () => {
  const yml = renderCpanelYml("/home/vhplasti/public_html/");

  assert.match(yml, /DEPLOYPATH=\/home\/vhplasti\/public_html\//);
  assert.match(yml, /\/bin\/cp -R assets catalogue Images "\$DEPLOYPATH"/);
  assert.match(
    yml,
    /\/bin\/cp \.htaccess index\.html favicon\.svg robots\.txt zalo\.png bibi-logo\.svg bibi-mark\.svg "\$DEPLOYPATH"/,
  );
});

test("artifact manifest contains every cPanel public entry", () => {
  assert.deepEqual(artifactEntries, [
    "assets",
    "catalogue",
    "Images",
    ".htaccess",
    "bibi-logo.svg",
    "bibi-mark.svg",
    "favicon.svg",
    "index.html",
    "robots.txt",
    "zalo.png",
  ]);
});

test("branch names become safe local workdir names", () => {
  assert.equal(toSafeWorkdirName("deploy/cpanel-temp"), "deploy-cpanel-temp");
});
