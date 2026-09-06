import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const backgroundSource = readFileSync(resolve(root, "background.js"), "utf8");

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function createHarness({ commands = [] } = {}) {
  let connectListener;
  let commandListener;
  const calls = {
    updates: [],
    getChildren: [],
    tabUpdates: [],
    tabCreates: [],
    errors: []
  };

  const browser = {
    commands: {
      onCommand: { addListener(fn) { commandListener = fn; } },
      async getAll() { return commands; },
      async update(value) { calls.updates.push(plain(value)); }
    },
    runtime: {
      onConnect: { addListener(fn) { connectListener = fn; } },
      getURL(path) { return `moz-extension://test/${path}`; }
    },
    bookmarks: {
      async getChildren(id) {
        calls.getChildren.push(id);
        return [{
          id: "bookmark-1",
          type: "bookmark",
          title: "Example",
          url: "https://example.com"
        }];
      }
    },
    tabs: {
      async query() { return [{ id: 7, pinned: false }]; },
      async update(...args) { calls.tabUpdates.push(plain(args)); },
      async create(options) { calls.tabCreates.push(plain(options)); }
    },
    action: {
      async setBadgeText() {},
      async setTitle() {},
      async setPopup() {},
      async openPopup() {}
    }
  };

  vm.runInContext(backgroundSource, vm.createContext({
    browser,
    Date,
    setTimeout() { return 1; },
    console: { error(...args) { calls.errors.push(args.map(String)); } }
  }), { filename: "background.js" });

  return {
    calls,
    async settle() {
      await new Promise((resolve) => setTimeout(resolve, 0));
    },
    connectShortcutProxy() {
      let messageListener;
      const port = {
        name: "shortcut-proxy",
        onMessage: { addListener(fn) { messageListener = fn; } },
        onDisconnect: { addListener() {} },
        postMessage() {}
      };
      connectListener(port);
      return {
        send(message) { return messageListener(message); }
      };
    },
    runCommand(command) { return commandListener(command); }
  };
}

test("restores only missing default shortcuts and preserves existing assignments", async () => {
  const harness = createHarness({
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
});

test("executes Alt+number requests sent directly from an open popup", async () => {
  const harness = createHarness();
  await harness.settle();
  const proxy = harness.connectShortcutProxy();

  await proxy.send({
    type: "invoke-toolbar-shortcut",
    position: 1,
    openInNewTab: false
  });

  assert.deepEqual(harness.calls.getChildren, ["toolbar_____"]);
  assert.deepEqual(harness.calls.tabUpdates, [[7, { url: "https://example.com" }]]);
  assert.deepEqual(harness.calls.tabCreates, []);
});

test("executes Alt+Shift+number popup requests in a new tab", async () => {
  const harness = createHarness();
  await harness.settle();
  const proxy = harness.connectShortcutProxy();

  await proxy.send({
    type: "invoke-toolbar-shortcut",
    position: 1,
    openInNewTab: true
  });

  assert.deepEqual(harness.calls.tabUpdates, []);
  assert.deepEqual(harness.calls.tabCreates, [{ url: "https://example.com" }]);
});
