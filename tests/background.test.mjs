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
  items = [{ type: "bookmark", url: "https://example.com/1" }],
  activeTab = { id: 17, pinned: false },
  bookmarksError = null
} = {}) {
  let listener;
  const calls = {
    getChildren: [],
    create: [],
    query: [],
    update: [],
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
    }
  };

  const context = vm.createContext({
    browser,
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

test("opens a toolbar bookmark in the active tab", async () => {
  const harness = createHarness();

  await harness.run("open-bookmark-1");

  assert.deepEqual(harness.calls.getChildren, ["toolbar_____"]);
  assert.deepEqual(harness.calls.query, [{ active: true, currentWindow: true }]);
  assert.deepEqual(harness.calls.update, [[17, { url: "https://example.com/1" }]]);
  assert.deepEqual(harness.calls.create, []);
  assert.deepEqual(harness.calls.errors, []);
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

test("keeps numbering aligned with toolbar positions including folders", async () => {
  const items = [
    { type: "folder", title: "Folder" },
    { type: "bookmark", url: "https://example.com/2" }
  ];
  const harness = createHarness({ items });

  await harness.run("open-bookmark-1");
  assert.deepEqual(harness.calls.query, []);
  assert.deepEqual(harness.calls.create, []);
  assert.deepEqual(harness.calls.update, []);

  await harness.run("open-bookmark-2");
  assert.deepEqual(harness.calls.update, [[17, { url: "https://example.com/2" }]]);
});

test("maps bookmark 10 to the tenth toolbar position", async () => {
  const items = Array.from({ length: 10 }, (_, index) => ({
    type: "bookmark",
    url: `https://example.com/${index + 1}`
  }));
  const harness = createHarness({ items });

  await harness.run("open-bookmark-10");

  assert.deepEqual(harness.calls.update, [[17, { url: "https://example.com/10" }]]);
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
});

test("contains browser API failures instead of rejecting the command listener", async () => {
  const harness = createHarness({ bookmarksError: new Error("boom") });

  await assert.doesNotReject(harness.run("open-bookmark-1"));
  assert.equal(harness.calls.errors.length, 1);
  assert.match(harness.calls.errors[0].join(" "), /Bookmark shortcut failed:/);
});
