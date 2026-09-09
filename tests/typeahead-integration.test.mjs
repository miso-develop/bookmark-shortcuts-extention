import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const folderHtml = readFileSync(resolve(root, "folder.html"), "utf8");
const typeaheadJs = readFileSync(resolve(root, "typeahead.js"), "utf8");
const buildJs = readFileSync(resolve(root, "scripts/build.mjs"), "utf8");

test("loads type-ahead before the existing folder keyboard handler", () => {
  const typeaheadIndex = folderHtml.indexOf('src="typeahead.js"');
  const folderIndex = folderHtml.indexOf('src="folder.js"');
  assert.ok(typeaheadIndex >= 0);
  assert.ok(folderIndex > typeaheadIndex);
});

test("limits type-ahead to the dedicated folder popup", () => {
  assert.equal(typeaheadJs.includes('classList.contains("full-page")'), true);
  assert.equal(typeaheadJs.includes('classList.contains("settings-view-active")'), true);
  assert.equal(typeaheadJs.includes('event.stopImmediatePropagation()'), true);
});

test("uses the resolver for repeated-character cycling and fresh-key fallback", () => {
  assert.equal(typeaheadJs.includes("export function resolveTypeaheadInput("), true);
  assert.equal(typeaheadJs.includes("currentIndex >= 0 ? currentIndex + 1 : 0"), true);
  assert.equal(typeaheadJs.includes("const combinedQuery = `${normalizedQuery}${normalizedKey}`;"), true);
  assert.equal(typeaheadJs.includes("query: normalizedKey"), true);
});

test("includes type-ahead in both Firefox and Chrome builds", () => {
  assert.equal(buildJs.includes('"typeahead.js"'), true);
});
