import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const folderHtml = readFileSync(resolve(root, "folder.html"), "utf8");
const folderCss = readFileSync(resolve(root, "folder.css"), "utf8");
const folderJs = readFileSync(resolve(root, "folder.js"), "utf8");
const settingsButtonJs = readFileSync(resolve(root, "settings-button.js"), "utf8");
const optionsHtml = readFileSync(resolve(root, "options.html"), "utf8");
const optionsJs = readFileSync(resolve(root, "options.js"), "utf8");
const optionsCss = readFileSync(resolve(root, "options.css"), "utf8");

test("keeps settings out of the folder popup and in the options page", () => {
  assert.equal(folderHtml.includes('id="always-new-tab"'), false);
  assert.equal(optionsHtml.includes('id="always-new-tab"'), true);
});

test("uses one explicit selection style and pointer movement does not override later keyboard input", () => {
  assert.equal(folderCss.includes(".item:focus-visible"), false);
  assert.equal(folderCss.includes(".item.keyboard-selected"), true);
  assert.equal(folderCss.includes("body.keyboard-navigation .item:hover:not(.keyboard-selected)"), true);
  assert.equal(folderJs.includes('item.addEventListener("focus"'), true);
  assert.equal(folderJs.includes('item.addEventListener("pointermove"'), true);
  assert.equal(folderJs.includes('item.addEventListener("mouseenter"'), false);
  assert.equal(folderJs.includes('setKeyboardNavigation(true)'), true);
  assert.equal(folderJs.includes('setKeyboardNavigation(false)'), true);
});

test("restores focus to the child folder item after navigating back", () => {
  assert.equal(folderJs.includes("const childFolderId = history.pop()"), true);
  assert.equal(folderJs.includes("focusFolderId: childFolderId"), true);
  assert.equal(folderJs.includes("findFolderSelectionIndex(selectableItems, focusFolderId)"), true);
});

test("left and right arrows switch root folders only through the root-folder navigator", () => {
  assert.equal(folderJs.includes('if (fullPageView || history.length !== 1 || !rootFolderId) return false;'), true);
  assert.equal(folderJs.includes('await navigateAdjacentRootFolder(-1);'), true);
  assert.equal(folderJs.includes('await navigateAdjacentRootFolder(1);'), true);
  assert.equal(folderJs.includes('if (history.length > 1) {\n        await goBack();\n      } else'), false);
});

test("traps received popup shortcuts in capture phase but leaves Escape available", () => {
  assert.equal(folderJs.includes('window.addEventListener("keydown", async (event) => {'), true);
  assert.equal(folderJs.includes('if (event.key === "Escape") {\n      return;'), true);
  assert.equal(folderJs.includes("event.preventDefault();"), true);
  assert.equal(folderJs.includes("event.stopImmediatePropagation();"), true);
  assert.equal(folderJs.includes("}, true);"), true);
});

test("handles Alt-number popup shortcuts directly without background popup state", () => {
  assert.equal(folderJs.includes('import { parsePopupShortcut } from "./popup-shortcuts.js";'), true);
  assert.equal(folderJs.includes("async function invokeToolbarShortcut"), true);
  assert.equal(folderJs.includes("runtime.connect"), false);
  assert.equal(folderJs.includes("shortcut-proxy"), false);
  assert.equal(folderHtml.includes('src="popup-shortcuts.js"'), false);
});

test("loads the shared platform adapter before the folder module", () => {
  const platformIndex = folderHtml.indexOf('src="platform.js"');
  const folderIndex = folderHtml.indexOf('src="folder.js"');
  assert.ok(platformIndex >= 0);
  assert.ok(folderIndex > platformIndex);
});

test("opens extension settings from an SVG gear button through the background", () => {
  assert.equal(folderHtml.includes('id="settings"'), true);
  assert.equal(folderHtml.includes('class="settings-icon"'), true);
  assert.equal(folderHtml.includes('<svg class="settings-icon"'), true);
  assert.equal(folderHtml.includes('>⚙</button>'), false);
  assert.equal(folderHtml.includes('src="settings-button.js"'), true);
  assert.equal(folderCss.includes(".settings-icon"), true);
  assert.equal(settingsButtonJs.includes('type: "open-options-page"'), true);
  assert.equal(settingsButtonJs.includes("runtime.openOptionsPage()"), false);
  assert.equal(settingsButtonJs.includes('event.key !== "Enter" && event.key !== " "'), true);

  const settingsIndex = folderHtml.indexOf('src="settings-button.js"');
  const folderIndex = folderHtml.indexOf('src="folder.js"');
  assert.ok(settingsIndex >= 0);
  assert.ok(folderIndex > settingsIndex);
});

test("uses a moderately larger Chrome font and denser popup rows", () => {
  assert.equal(settingsButtonJs.includes('classList.toggle("browser-chrome"'), true);
  assert.equal(folderCss.includes("body.browser-chrome {\n  font-size: 14px;"), true);
  assert.equal(folderCss.includes("padding: 3px 8px;"), true);
  assert.equal(folderCss.includes("line-height: 1.05;"), true);
  assert.equal(folderCss.includes("width: 21px;\n  height: 21px;"), true);
});

test("matches the Chrome options-page font size to the popup", () => {
  assert.equal(optionsJs.includes('classList.toggle("browser-chrome"'), true);
  assert.equal(optionsCss.includes("body.browser-chrome {\n  font-size: 14px;"), true);
});

test("shows root toolbar position and supports Chrome favicon rendering", () => {
  assert.equal(folderHtml.includes('id="root-position"'), true);
  assert.equal(folderCss.includes(".root-position"), true);
  assert.equal(folderCss.includes(".item-icon img"), true);
  assert.equal(folderJs.includes("platform.getFaviconUrl?.(item.url, 16)"), true);
});

test("Chrome options expose shortcut diagnostics and clickable shortcut settings links", () => {
  assert.equal(optionsHtml.includes('id="chrome-settings"'), true);
  assert.equal(optionsHtml.includes('id="shortcut-summary"'), true);
  assert.equal(optionsHtml.includes('class="chrome-shortcuts-link"'), true);
  assert.equal(optionsHtml.includes('chrome://extensions/shortcuts'), true);
  assert.equal(optionsHtml.includes('id="bookmark-source"'), true);
  assert.equal(optionsJs.includes("extensionApi.commands.getAll()"), true);
  assert.equal(optionsJs.includes('type: "open-chrome-shortcuts"'), true);
  assert.equal(optionsJs.includes('className = "shortcut-link chrome-shortcuts-link"'), true);
  assert.equal(optionsJs.includes("platform.setBookmarkBarPreference"), true);
  assert.equal(optionsCss.includes(".chrome-shortcuts-link"), true);
  assert.equal(optionsCss.includes(".shortcut-link"), true);
});

test("defines a full-page layout for folder views opened in a tab", () => {
  assert.equal(folderCss.includes("body.full-page"), true);
  assert.equal(folderCss.includes(".full-page main"), true);
  assert.equal(folderJs.includes('document.body.classList.add("full-page")'), true);
});
