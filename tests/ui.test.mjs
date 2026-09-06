import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const folderHtml = readFileSync(resolve(root, "folder.html"), "utf8");
const folderCss = readFileSync(resolve(root, "folder.css"), "utf8");
const folderJs = readFileSync(resolve(root, "folder.js"), "utf8");
const optionsHtml = readFileSync(resolve(root, "options.html"), "utf8");

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

test("left arrow does not navigate back from a subfolder", () => {
  assert.equal(folderJs.includes('if (history.length === 1) {\n        navigateAdjacentRootFolder(-1);'), true);
  assert.equal(folderJs.includes('if (history.length > 1) {\n        await goBack();\n      } else'), false);
});

test("traps received popup shortcuts in capture phase but leaves Escape available", () => {
  assert.equal(folderJs.includes('window.addEventListener("keydown", async (event) => {'), true);
  assert.equal(folderJs.includes('if (event.key === "Escape") {\n      return;'), true);
  assert.equal(folderJs.includes("event.preventDefault();"), true);
  assert.equal(folderJs.includes("event.stopImmediatePropagation();"), true);
  assert.equal(folderJs.includes("}, true);"), true);
});

test("centralizes Alt-number popup shortcuts in the folder view", () => {
  assert.equal(folderJs.includes('import { parsePopupShortcut } from "./popup-shortcuts.js";'), true);
  assert.equal(folderJs.includes('browser.runtime.connect({ name: "shortcut-proxy" })'), true);
  assert.equal(folderHtml.includes('src="popup-shortcuts.js"'), false);
});

test("defines a full-page layout for folder views opened in a tab", () => {
  assert.equal(folderCss.includes("body.full-page"), true);
  assert.equal(folderCss.includes(".full-page main"), true);
  assert.equal(folderJs.includes('document.body.classList.add("full-page")'), true);
});
