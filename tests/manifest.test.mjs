import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(resolve(root, "manifest.json"), "utf8"));
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));

function shortcutFor(index, newTab = false) {
  const digit = index === 10 ? "0" : String(index);
  return newTab ? `Alt+Shift+${digit}` : `Alt+${digit}`;
}

test("uses Firefox Manifest V3 with the minimum bookmark permission", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ["bookmarks"]);
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.content_scripts, undefined);

  const serialized = JSON.stringify(manifest);
  for (const forbidden of ["<all_urls>", "tabs", "storage", "activeTab"]) {
    assert.equal(serialized.includes(`\"${forbidden}\"`), false, `must not request ${forbidden}`);
  }
});

test("declares that the extension collects no data", () => {
  assert.deepEqual(
    manifest.browser_specific_settings?.gecko?.data_collection_permissions?.required,
    ["none"]
  );
});

test("loads only the audited background script", () => {
  assert.deepEqual(manifest.background, { scripts: ["background.js"] });
});

test("places the feedback action on the Firefox bookmarks toolbar", () => {
  assert.equal(manifest.action?.default_area, "personaltoolbar");
  assert.equal(manifest.action?.default_title, "Bookmark Shortcuts");
  assert.equal(manifest.action?.default_popup, "folder.html");
  assert.equal(manifest.action?.default_icon, "icons/bookmark-shortcuts.svg");
  assert.equal(existsSync(resolve(root, manifest.action.default_popup)), true);
  assert.equal(existsSync(resolve(root, manifest.action.default_icon)), true);
});

test("declares all 20 keyboard commands with the expected shortcuts", () => {
  assert.equal(Object.keys(manifest.commands).length, 20);

  for (let index = 1; index <= 10; index += 1) {
    const current = manifest.commands[`open-bookmark-${index}`];
    const newTab = manifest.commands[`open-bookmark-new-${index}`];

    assert.ok(current, `missing current-tab command ${index}`);
    assert.ok(newTab, `missing new-tab command ${index}`);
    assert.equal(current.suggested_key.default, shortcutFor(index));
    assert.equal(newTab.suggested_key.default, shortcutFor(index, true));
  }
});

test("keeps package and extension versions aligned", () => {
  assert.equal(packageJson.version, manifest.version);
});
