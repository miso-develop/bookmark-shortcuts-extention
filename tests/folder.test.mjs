import assert from "node:assert/strict";
import test from "node:test";

import {
  getFolderData,
  getKeyboardAction,
  nextSelectionIndex,
  openBookmarkUrl,
  pageSelectionIndex,
  shouldOpenInNewTab
} from "../folder.js";

test("loads a bookmark folder and its children", async () => {
  const calls = { get: [], getChildren: [] };
  const bookmarks = {
    async get(id) {
      calls.get.push(id);
      return [{ id, type: "folder", title: "Tools", parentId: "toolbar_____" }];
    },
    async getChildren(id) {
      calls.getChildren.push(id);
      return [
        { id: "child-folder", type: "folder", title: "Nested" },
        { id: "bookmark-1", type: "bookmark", title: "Example", url: "https://example.com" }
      ];
    }
  };

  const result = await getFolderData(bookmarks, "folder-1");

  assert.equal(result.folder.title, "Tools");
  assert.equal(result.items.length, 2);
  assert.deepEqual(calls.get, ["folder-1"]);
  assert.deepEqual(calls.getChildren, ["folder-1"]);
});

test("rejects a non-folder node", async () => {
  const bookmarks = {
    async get() {
      return [{ id: "bookmark-1", type: "bookmark", url: "https://example.com" }];
    },
    async getChildren() {
      throw new Error("must not be called");
    }
  };

  await assert.rejects(getFolderData(bookmarks, "bookmark-1"), /Bookmark folder not found/);
});

test("opens a folder bookmark target in the current tab", async () => {
  const calls = { query: [], update: [], create: [] };
  const tabs = {
    async query(info) {
      calls.query.push(info);
      return [{ id: 7, pinned: false }];
    },
    async update(...args) {
      calls.update.push(args);
    },
    async create(options) {
      calls.create.push(options);
    }
  };

  const result = await openBookmarkUrl(tabs, "https://example.com");

  assert.equal(result, "current-tab");
  assert.deepEqual(calls.query, [{ active: true, currentWindow: true }]);
  assert.deepEqual(calls.update, [[7, { url: "https://example.com" }]]);
  assert.deepEqual(calls.create, []);
});

test("forces a folder bookmark target into a new tab", async () => {
  const calls = { query: [], update: [], create: [] };
  const tabs = {
    async query(info) {
      calls.query.push(info);
      return [{ id: 7, pinned: false }];
    },
    async update(...args) {
      calls.update.push(args);
    },
    async create(options) {
      calls.create.push(options);
    }
  };

  const result = await openBookmarkUrl(tabs, "https://example.com", { forceNewTab: true });

  assert.equal(result, "new-tab");
  assert.deepEqual(calls.query, []);
  assert.deepEqual(calls.update, []);
  assert.deepEqual(calls.create, [{ url: "https://example.com" }]);
});

test("protects a pinned tab when a bookmark is selected from a folder", async () => {
  const calls = { update: [], create: [] };
  const tabs = {
    async query() {
      return [{ id: 7, pinned: true }];
    },
    async update(...args) {
      calls.update.push(args);
    },
    async create(options) {
      calls.create.push(options);
    }
  };

  const result = await openBookmarkUrl(tabs, "https://example.com");

  assert.equal(result, "new-tab");
  assert.deepEqual(calls.update, []);
  assert.deepEqual(calls.create, [{ url: "https://example.com" }]);
});

test("moves selection down and wraps at the end", () => {
  assert.equal(nextSelectionIndex(0, 3, 1), 1);
  assert.equal(nextSelectionIndex(2, 3, 1), 0);
});

test("moves selection up and wraps at the beginning", () => {
  assert.equal(nextSelectionIndex(2, 3, -1), 1);
  assert.equal(nextSelectionIndex(0, 3, -1), 2);
});

test("starts keyboard selection naturally when nothing is selected", () => {
  assert.equal(nextSelectionIndex(-1, 3, 1), 0);
  assert.equal(nextSelectionIndex(-1, 3, -1), 2);
  assert.equal(nextSelectionIndex(-1, 0, 1), -1);
});

test("moves selection by one visible page and clamps at boundaries", () => {
  assert.equal(pageSelectionIndex(2, 20, 6, 1), 8);
  assert.equal(pageSelectionIndex(18, 20, 6, 1), 19);
  assert.equal(pageSelectionIndex(8, 20, 6, -1), 2);
  assert.equal(pageSelectionIndex(2, 20, 6, -1), 0);
});

test("page selection starts naturally when nothing is selected", () => {
  assert.equal(pageSelectionIndex(-1, 20, 6, 1), 0);
  assert.equal(pageSelectionIndex(-1, 20, 6, -1), 19);
  assert.equal(pageSelectionIndex(-1, 0, 6, 1), -1);
});

test("maps popup navigation keys and ctrl-enter to actions", () => {
  assert.equal(getKeyboardAction("ArrowDown"), "next");
  assert.equal(getKeyboardAction("ArrowUp"), "previous");
  assert.equal(getKeyboardAction("PageDown"), "page-next");
  assert.equal(getKeyboardAction("PageUp"), "page-previous");
  assert.equal(getKeyboardAction("Enter"), "activate");
  assert.equal(getKeyboardAction("Enter", { ctrlKey: true }), "activate-new-tab");
  assert.equal(getKeyboardAction("ArrowLeft"), "back");
  assert.equal(getKeyboardAction("Backspace"), "back");
  assert.equal(getKeyboardAction("Escape"), null);
});

test("resolves ctrl-enter and the persistent new-tab option", () => {
  assert.equal(shouldOpenInNewTab(), false);
  assert.equal(shouldOpenInNewTab({ ctrlKey: true }), true);
  assert.equal(shouldOpenInNewTab({ alwaysNewTab: true }), true);
  assert.equal(shouldOpenInNewTab({ ctrlKey: true, alwaysNewTab: true }), true);
});
