import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const firefoxManifest = JSON.parse(readFileSync(resolve(root, "manifest.json"), "utf8"));
const chromeManifest = JSON.parse(readFileSync(resolve(root, "manifest.chrome.json"), "utf8"));
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));

function shortcutFor(index, newTab = false) {
  const digit = index === 10 ? "0" : String(index);
  return newTab ? `Alt+Shift+${digit}` : `Alt+${digit}`;
}

function assertNoBroadAccess(manifest) {
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.content_scripts, undefined);
  const serialized = JSON.stringify(manifest);
  for (const forbidden of ["<all_urls>", "tabs", "activeTab"]) {
    assert.equal(serialized.includes(`\"${forbidden}\"`), false, `must not request ${forbidden}`);
  }
}

test("uses Firefox Manifest V3 with the minimum bookmark permission", () => {
  assert.equal(firefoxManifest.manifest_version, 3);
  assert.deepEqual(firefoxManifest.permissions, ["bookmarks"]);
  assertNoBroadAccess(firefoxManifest);
  assert.deepEqual(firefoxManifest.background, {
    scripts: ["platform.js", "background.js"]
  });
});

test("declares that the Firefox extension collects no data", () => {
  assert.deepEqual(
    firefoxManifest.browser_specific_settings?.gecko?.data_collection_permissions?.required,
    ["none"]
  );
});

test("places the Firefox feedback action on the bookmarks toolbar", () => {
  assert.equal(firefoxManifest.action?.default_area, "personaltoolbar");
  assert.equal(firefoxManifest.action?.default_title, "Bookmark Shortcuts");
  assert.equal(firefoxManifest.action?.default_popup, "folder.html");
  assert.equal(existsSync(resolve(root, firefoxManifest.action.default_popup)), true);
});

test("declares all 20 Firefox commands with their default shortcuts", () => {
  assert.equal(Object.keys(firefoxManifest.commands).length, 20);
  for (let index = 1; index <= 10; index += 1) {
    assert.equal(
      firefoxManifest.commands[`open-bookmark-${index}`].suggested_key.default,
      shortcutFor(index)
    );
    assert.equal(
      firefoxManifest.commands[`open-bookmark-new-${index}`].suggested_key.default,
      shortcutFor(index, true)
    );
  }
});

test("uses Chrome Manifest V3 with bookmarks and favicon permissions only", () => {
  assert.equal(chromeManifest.manifest_version, 3);
  assert.equal(chromeManifest.minimum_chrome_version, "134");
  assert.deepEqual(chromeManifest.permissions, ["bookmarks", "favicon"]);
  assert.equal(chromeManifest.browser_specific_settings, undefined);
  assert.equal(chromeManifest.action?.default_area, undefined);
  assert.deepEqual(chromeManifest.background, { service_worker: "background.js" });
  assertNoBroadAccess(chromeManifest);
});

test("declares all 20 Chrome commands but suggests only the first four", () => {
  assert.equal(Object.keys(chromeManifest.commands).length, 20);
  const suggested = Object.entries(chromeManifest.commands)
    .filter(([, command]) => command.suggested_key)
    .map(([name]) => name);
  assert.deepEqual(suggested, [
    "open-bookmark-1",
    "open-bookmark-2",
    "open-bookmark-3",
    "open-bookmark-4"
  ]);
  for (let index = 1; index <= 4; index += 1) {
    assert.equal(
      chromeManifest.commands[`open-bookmark-${index}`].suggested_key.default,
      shortcutFor(index)
    );
  }
});

test("exposes the same options UI in both browser manifests", () => {
  const expected = { page: "options.html", open_in_tab: false };
  assert.deepEqual(firefoxManifest.options_ui, expected);
  assert.deepEqual(chromeManifest.options_ui, expected);
  for (const file of ["options.html", "options.js", "options.css", "platform.js"]) {
    assert.equal(existsSync(resolve(root, file)), true, `${file} must exist`);
  }
});

test("keeps package and both extension versions aligned", () => {
  assert.equal(packageJson.version, firefoxManifest.version);
  assert.equal(packageJson.version, chromeManifest.version);
});
