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

function createHarness({
  items = [{ id: "bookmark-1", type: "bookmark", title: "Example", url: "https://example.com/1" }],
  activeTab = { id: 17, pinned: false },
  bookmarksError = null,
  openPopupError = null
} = {}) {
  let listener;
  const calls = {
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

  const browser = {
    commands: {
      onCommand: {
        addListener(fn) {
          listener = fn;
        }
      }
    },
    bookmarks: {
      async getChildren(id) {
        calls.getChildren.push(id);
        if (bookmarksError) {
          throw bookmarksError;
        }
        return items;
      }
    },
    tabs: {
      async create(options) {
        calls.create.push(plain(options));
        return { id: 99, ...plain(options) };
      },
      async query(queryInfo) {
        calls.query.push(plain(queryInfo));
        return activeTab ? [activeTab] : [];
      },
      async update(...args) {
        calls.update.push(plain(args));
        return {};
      }
    },
    action: {
      async setBadgeText(options) {
        calls.setBadgeText.push(plain(options));
      },
      async setTitle(options) {
        calls.setTitle.push(plain(options));
      },
      async setPopup(options) {
        calls.setPopup.push(plain(options));
      },
      async openPopup() {
        calls.openPopup += 1;
        if (openPopupError) {
          throw openPopupError;
        }
      }
    },
    runtime: {
      getURL(path) {
        calls.getURL.push(path);
        return `moz-extension://test/${path}`;
      }
    }
  };

  const context = vm.createContext({
    browser,
    setTimeout(fn, delay) {
      calls.timers.push({ fn, delay });
      return calls.timers.length;
    },
    console: {
      error(...args) {
        calls.errors.push(args.map(String));
      }
    }
  });

  vm.runInContext(backgroundSource, context, { filename: "background.js" });
  assert.equal(typeof listener, "function");

  return {
    calls,
    run(command) {
      return listener(command);
    }
  };
}

test("opens a toolbar bookmark in the active tab and shows feedback", async () => {
  const harness = createHarness();

  await harness.run("open-bookmark-1");

  assert.deepEqual(harness.calls.getChildren, ["toolbar_____"]);
  assert.deepEqual(harness.calls.query, [{ active: true, currentWindow: true }]);
  assert.deepEqual(harness.calls.update, [[17, { url: "https://example.com/1" }]]);
  assert.deepEqual(harness.calls.create, []);
  assert.deepEqual(harness.calls.setBadgeText, [{ text: "1" }]);
  assert.deepEqual(harness.calls.setTitle, [{ title: "1: Example" }]);
  assert.equal(harness.calls.timers[0].delay, 900);
  assert.deepEqual(harness.calls.errors, []);
});

test("clears toolbar feedback after the feedback timer", async () => {
  const harness = createHarness();

  await harness.run("open-bookmark-1");
  await harness.calls.timers[0].fn();

  assert.deepEqual(harness.calls.setBadgeText, [{ text: "1" }, { text: "" }]);
  assert.deepEqual(harness.calls.setTitle, [
    { title: "1: Example" },
    { title: "Bookmark Shortcuts" }
  ]);
});

test("opens a bookmark in a new tab for the new-tab command", async () => {
  const harness = createHarness();

  await harness.run("open-bookmark-new-1");

  assert.deepEqual(harness.calls.create, [{ url: "https://example.com/1" }]);
  assert.deepEqual(harness.calls.query, []);
  assert.deepEqual(harness.calls.update, []);
});

test("does not replace a pinned active tab", async () => {
  const harness = createHarness({ activeTab: { id: 17, pinned: true } });

  await harness.run("open-bookmark-1");

  assert.deepEqual(harness.calls.create, [{ url: "https://example.com/1" }]);
  assert.deepEqual(harness.calls.update, []);
});

test("opens a toolbar folder in the bookmarks-toolbar action popup", async () => {
  const items = [
    { id: "folder/1", type: "folder", title: "Tools" },
    { id: "bookmark-2", type: "bookmark", title: "Second", url: "https://example.com/2" }
  ];
  const harness = createHarness({ items });

  await harness.run("open-bookmark-1");

  assert.deepEqual(harness.calls.setPopup, [{ popup: "folder.html?id=folder%2F1" }]);
  assert.equal(harness.calls.openPopup, 1);
  assert.deepEqual(harness.calls.setBadgeText, [{ text: "F1" }]);
  assert.deepEqual(harness.calls.setTitle, [{ title: "1: Tools" }]);
  assert.deepEqual(harness.calls.query, []);
  assert.deepEqual(harness.calls.create, []);
  assert.deepEqual(harness.calls.update, []);
});

test("falls back to a tab when the folder popup cannot be opened", async () => {
  const harness = createHarness({
    items: [{ id: "folder-1", type: "folder", title: "Tools" }],
    openPopupError: new Error("popup blocked")
  });

  await harness.run("open-bookmark-1");

  assert.deepEqual(harness.calls.getURL, ["folder.html?id=folder-1"]);
  assert.deepEqual(harness.calls.create, [
    { url: "moz-extension://test/folder.html?id=folder-1" }
  ]);
  assert.deepEqual(harness.calls.errors, []);
});

test("keeps numbering aligned with toolbar positions including separators", async () => {
  const items = [
    { id: "separator-1", type: "separator" },
    { id: "bookmark-2", type: "bookmark", title: "Second", url: "https://example.com/2" }
  ];
  const harness = createHarness({ items });

  await harness.run("open-bookmark-1");
  assert.deepEqual(harness.calls.query, []);
  assert.deepEqual(harness.calls.create, []);
  assert.deepEqual(harness.calls.update, []);
  assert.deepEqual(harness.calls.setBadgeText, []);

  await harness.run("open-bookmark-2");
  assert.deepEqual(harness.calls.update, [[17, { url: "https://example.com/2" }]]);
});

test("maps bookmark 10 to the tenth toolbar position", async () => {
  const items = Array.from({ length: 10 }, (_, index) => ({
    id: `bookmark-${index + 1}`,
    type: "bookmark",
    title: `Bookmark ${index + 1}`,
    url: `https://example.com/${index + 1}`
  }));
  const harness = createHarness({ items });

  await harness.run("open-bookmark-10");

  assert.deepEqual(harness.calls.update, [[17, { url: "https://example.com/10" }]]);
  assert.deepEqual(harness.calls.setBadgeText, [{ text: "10" }]);
});

test("uses the current tab overload when no active tab id is available", async () => {
  const harness = createHarness({ activeTab: null });

  await harness.run("open-bookmark-1");

  assert.deepEqual(harness.calls.update, [[{ url: "https://example.com/1" }]]);
});

test("ignores unknown commands before reading bookmarks", async () => {
  const harness = createHarness();

  await harness.run("open-bookmark-11");

  assert.deepEqual(harness.calls.getChildren, []);
  assert.deepEqual(harness.calls.create, []);
  assert.deepEqual(harness.calls.update, []);
  assert.deepEqual(harness.calls.setBadgeText, []);
});

test("contains browser API failures instead of rejecting the command listener", async () => {
  const harness = createHarness({ bookmarksError: new Error("boom") });

  await assert.doesNotReject(harness.run("open-bookmark-1"));
  assert.equal(harness.calls.errors.length, 1);
  assert.match(harness.calls.errors[0].join(" "), /Bookmark shortcut failed:/);
});
