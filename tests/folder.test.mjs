import assert from "node:assert/strict";
import test from "node:test";

import { getFolderData, openBookmarkUrl } from "../folder.js";

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

  await assert.rejects(
    getFolderData(bookmarks, "bookmark-1"),
    /Bookmark folder not found/
  );
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
