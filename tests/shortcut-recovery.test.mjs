import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const platformSource = readFileSync(resolve(root, "platform.js"), "utf8");
const backgroundSource = readFileSync(resolve(root, "background.js"), "utf8");

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function createFirefoxHarness({ commands = [] } = {}) {
  let commandListener;
  const calls = { updates: [], errors: [] };
  const browser = {
    commands: {
      onCommand: { addListener(fn) { commandListener = fn; } },
      async getAll() { return commands; },
      async update(value) { calls.updates.push(plain(value)); }
    },
    runtime: {
      async getBrowserInfo() { return { name: "Firefox" }; },
      getURL(path) { return `moz-extension://test/${path}`; }
    },
    bookmarks: { async getChildren() { return []; } },
    tabs: {
      async query() { return []; },
      async update() {},
      async create() {}
    },
    action: {
      async setBadgeText() {},
      async setTitle() {},
      async setPopup() {},
      async openPopup() {}
    }
  };

  const context = vm.createContext({
    browser,
    Date,
    URL,
    URLSearchParams,
    setTimeout() { return 1; },
    console: { error(...args) { calls.errors.push(args.map(String)); } }
  });
  vm.runInContext(platformSource, context, { filename: "platform.js" });
  vm.runInContext(backgroundSource, context, { filename: "background.js" });

  return {
    calls,
    commandListener,
    async settle() {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  };
}

test("Firefox restores only missing default shortcuts and preserves existing assignments", async () => {
  const harness = createFirefoxHarness({
    commands: [
      { name: "open-bookmark-1", shortcut: "" },
      { name: "open-bookmark-2", shortcut: "Alt+8" },
      { name: "open-bookmark-new-10", shortcut: "" }
    ]
  });

  await harness.settle();

  assert.deepEqual(harness.calls.updates, [
    { name: "open-bookmark-1", shortcut: "Alt+1" },
    { name: "open-bookmark-new-10", shortcut: "Alt+Shift+0" }
  ]);
  assert.equal(typeof harness.commandListener, "function");
});
