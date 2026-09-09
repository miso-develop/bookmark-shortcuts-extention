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

function createHarness({
  kind = "firefox",
  items = [{ id: "bookmark-1", type: "bookmark", title: "Example", url: "https://example.com/1" }],
  activeTab = { id: 17, pinned: false },
  bookmarksError = null,
  openPopupError = null,
  chromeBars = null
} = {}) {
  let commandListener;
  let messageListener;
  const calls = {
    getTree: 0,
    getChildren: [],
    create: [],
    query: [],
    update: [],
    setBadgeText: [],
    setTitle: [],
    setPopup: [],
    openPopup: 0,
    getURL: [],
    timers: [],
    errors: []
  };

  const commands = {
    onCommand: { addListener(fn) { commandListener = fn; } }
  };

  if (kind === "firefox") {
    commands.getAll = async () => [];
    commands.update = async () => {};
  } else {
    commands.getAll = async () => [];
  }

  const bookmarkApi = {
    async getChildren(id) {
      calls.getChildren.push(id);
      if (bookmarksError) throw bookmarksError;
      if (kind === "chrome" && chromeBars) {
        return chromeBars[id]?.items ?? [];
      }
      return items;
    }
  };

  if (kind === "chrome") {
    bookmarkApi.getTree = async () => {
      calls.getTree += 1;
      const bars = chromeBars ?? {
        account: {
          node: { id: "account", title: "Bookmarks bar", folderType: "bookmarks-bar", syncing: true },
          items
        }
      };
      return [{
        id: "0",
        title: "root",
        children: Object.values(bars).map(({ node }) => ({ ...node }))
      }];
    };
  }

  const runtime = {
    onMessage: { addListener(fn) { messageListener = fn; } },
    getURL(path) {
      calls.getURL.push(path);
      return `${kind === "chrome" ? "chrome" : "moz"}-extension://test/${path}`;
    }
  };
  if (kind === "firefox") {
    runtime.getBrowserInfo = async () => ({ name: "Firefox" });
  }

  const extensionApi = {
    commands,
    bookmarks: bookmarkApi,
    tabs: {
      async create(options) { calls.create.push(plain(options)); return { id: 99, ...plain(options) }; },
      async query(queryInfo) { calls.query.push(plain(queryInfo)); return activeTab ? [activeTab] : []; },
      async update(...args) { calls.update.push(plain(args)); return {}; }
    },
    action: {
      async setBadgeText(options) { calls.setBadgeText.push(plain(options)); },
      async setTitle(options) { calls.setTitle.push(plain(options)); },
      async setPopup(options) { calls.setPopup.push(plain(options)); },
      async openPopup() {
        calls.openPopup += 1;
        if (openPopupError) throw openPopupError;
      }
    },
    runtime
  };

  const globals = {
    Date,
    URL,
    URLSearchParams,
    setTimeout(fn, delay) { calls.timers.push({ fn, delay }); return calls.timers.length; },
    console: { error(...args) { calls.errors.push(args.map(String)); } }
  };
  if (kind === "chrome") globals.chrome = extensionApi;
  else globals.browser = extensionApi;

  const context = vm.createContext(globals);
  vm.runInContext(platformSource, context, { filename: "platform.js" });
  vm.runInContext(backgroundSource, context, { filename: "background.js" });
  assert.equal(typeof commandListener, "function");

  return {
    calls,
    run(command) { return commandListener(command); },
    sendMessage(message) {
      assert.equal(typeof messageListener, "function");
      return messageListener(message);
    }
  };
}

test("opens a Firefox bookmarks-toolbar bookmark in the active tab", async () => {
  const harness = createHarness();
  await harness.run("open-bookmark-1");
  assert.deepEqual(harness.calls.getChildren, ["toolbar_____"]);
  assert.deepEqual(harness.calls.update, [[17, { url: "https://example.com/1" }]]);
  assert.deepEqual(harness.calls.setBadgeText, [{ text: "1" }]);
});

test("selects the syncing Chrome bookmarks bar by default when multiple bars exist", async () => {
  const harness = createHarness({
    kind: "chrome",
    chromeBars: {
      local: {
        node: { id: "local", title: "Bookmarks bar", folderType: "bookmarks-bar", syncing: false },
        items: [{ id: "local-bookmark", title: "Local", url: "https://local.example" }]
      },
      account: {
        node: { id: "account", title: "Bookmarks bar", folderType: "bookmarks-bar", syncing: true },
        items: [{ id: "account-bookmark", title: "Account", url: "https://account.example" }]
      }
    }
  });

  await harness.run("open-bookmark-1");
  assert.equal(harness.calls.getTree, 1);
  assert.deepEqual(harness.calls.getChildren, ["account"]);
  assert.deepEqual(harness.calls.update, [[17, { url: "https://account.example" }]]);
});

test("opens Chrome shortcut settings from an options-page message", async () => {
  const harness = createHarness({ kind: "chrome" });
  const response = await harness.sendMessage({ type: "open-chrome-shortcuts" });

  assert.deepEqual(plain(response), { ok: true });
  assert.deepEqual(harness.calls.create, [
    { url: "chrome://extensions/shortcuts" }
  ]);
});

test("recognizes a Chrome folder without Firefox's type property", async () => {
  const harness = createHarness({
    kind: "chrome",
    chromeBars: {
      account: {
        node: { id: "account", title: "Bookmarks bar", folderType: "bookmarks-bar", syncing: true },
        items: [{ id: "folder/1", title: "Tools" }]
      }
    }
  });

  await harness.run("open-bookmark-1");
  assert.deepEqual(harness.calls.setPopup, [
    { popup: "folder.html?id=folder%2F1&position=1" }
  ]);
  assert.equal(harness.calls.openPopup, 1);
  assert.deepEqual(harness.calls.setBadgeText, [{ text: "F1" }]);
});

test("opens a bookmark in a new tab for the new-tab command", async () => {
  const harness = createHarness();
  await harness.run("open-bookmark-new-1");
  assert.deepEqual(harness.calls.create, [{ url: "https://example.com/1" }]);
  assert.deepEqual(harness.calls.update, []);
});

test("does not replace a pinned active tab", async () => {
  const harness = createHarness({ activeTab: { id: 17, pinned: true } });
  await harness.run("open-bookmark-1");
  assert.deepEqual(harness.calls.create, [{ url: "https://example.com/1" }]);
  assert.deepEqual(harness.calls.update, []);
});

test("falls back to the full-page folder view when the popup cannot be opened", async () => {
  const harness = createHarness({
    items: [{ id: "folder-1", type: "folder", title: "Tools" }],
    openPopupError: new Error("popup blocked")
  });
  await harness.run("open-bookmark-1");
  assert.deepEqual(harness.calls.getURL, ["folder.html?id=folder-1&position=1&view=tab"]);
  assert.deepEqual(harness.calls.create, [
    { url: "moz-extension://test/folder.html?id=folder-1&position=1&view=tab" }
  ]);
});

test("keeps numbering aligned with Firefox separators", async () => {
  const harness = createHarness({ items: [
    { id: "separator-1", type: "separator" },
    { id: "bookmark-2", type: "bookmark", title: "Second", url: "https://example.com/2" }
  ] });
  await harness.run("open-bookmark-1");
  assert.deepEqual(harness.calls.update, []);
  await harness.run("open-bookmark-2");
  assert.deepEqual(harness.calls.update, [[17, { url: "https://example.com/2" }]]);
});

test("ignores unknown commands before reading bookmarks", async () => {
  const harness = createHarness();
  await harness.run("open-bookmark-11");
  assert.deepEqual(harness.calls.getChildren, []);
});

test("contains bookmark API failures instead of rejecting the command listener", async () => {
  const harness = createHarness({ bookmarksError: new Error("boom") });
  await assert.doesNotReject(harness.run("open-bookmark-1"));
  assert.equal(harness.calls.errors.length, 1);
  assert.match(harness.calls.errors[0].join(" "), /Bookmark shortcut failed:/);
});
