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

test("uses one explicit selection style instead of a stale focus-visible highlight", () => {
  assert.equal(folderCss.includes(".item:focus-visible"), false);
  assert.equal(folderCss.includes(".item.keyboard-selected"), true);
  assert.equal(folderJs.includes('item.addEventListener("focus"'), true);
  assert.equal(folderJs.includes('item.addEventListener("mouseenter"'), true);
  assert.equal(folderJs.includes('document.addEventListener("focusin"'), true);
});

test("restores focus to the child folder item after navigating back", () => {
  assert.equal(folderJs.includes("const childFolderId = history.pop()"), true);
  assert.equal(folderJs.includes("focusFolderId: childFolderId"), true);
  assert.equal(folderJs.includes("findFolderSelectionIndex(selectableItems, focusFolderId)"), true);
});

test("defines a full-page layout for folder views opened in a tab", () => {
  assert.equal(folderCss.includes("body.full-page"), true);
  assert.equal(folderCss.includes(".full-page main"), true);
  assert.equal(folderJs.includes('document.body.classList.add("full-page")'), true);
});
