import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const settingsButtonJs = readFileSync(resolve(root, "settings-button.js"), "utf8");

test("Firefox redirects initial Shift+Tab from folder content to the settings gear", () => {
  assert.equal(settingsButtonJs.includes("function shouldRedirectFirefoxReverseTab(event)"), true);
  assert.equal(settingsButtonJs.includes("if (platform?.isChrome || settingsActive()) return false;"), true);
  assert.equal(settingsButtonJs.includes('event.key !== "Tab" || !event.shiftKey'), true);
  assert.equal(settingsButtonJs.includes('document.querySelector("#items .item:not(:disabled)")'), true);
  assert.equal(settingsButtonJs.includes("active === document.body"), true);
  assert.equal(settingsButtonJs.includes("active === document.documentElement"), true);
  assert.equal(settingsButtonJs.includes('active.matches("#items hr")'), true);
  assert.equal(settingsButtonJs.includes("settingsButton.focus({ preventScroll: true });"), true);
});

test("Firefox separator focus is redirected away from the item-area divider", () => {
  assert.equal(settingsButtonJs.includes('document.addEventListener("focusin"'), true);
  assert.equal(settingsButtonJs.includes('event.target.matches("#items hr")'), true);
  assert.equal(settingsButtonJs.includes("if (platform?.isChrome || settingsActive() || settingsButton.hidden) return;"), true);
});
