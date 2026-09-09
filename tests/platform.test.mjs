import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const platformSource = readFileSync(resolve(root, "platform.js"), "utf8");

function loadPlatform(globals) {
  const context = vm.createContext({ URL, ...globals });
  vm.runInContext(platformSource, context, { filename: "platform.js" });
  return context.BookmarkShortcutsPlatform;
}

test("normalizes Firefox and Chrome bookmark node shapes", () => {
  const platform = loadPlatform({
    browser: {
      runtime: { async getBrowserInfo() { return { name: "Firefox" }; } },
      commands: {}
    }
  });

  assert.equal(platform.getNodeType({ type: "folder" }), "folder");
  assert.equal(platform.getNodeType({ type: "separator" }), "separator");
  assert.equal(platform.getNodeType({ type: "bookmark", url: "https://example.com" }), "bookmark");
  assert.equal(platform.getNodeType({ id: "chrome-folder", title: "Folder" }), "folder");
  assert.equal(platform.getNodeType({ id: "chrome-bookmark", url: "https://example.com" }), "bookmark");
});

test("uses the canonical Firefox bookmarks toolbar id", async () => {
  const platform = loadPlatform({
    browser: {
      runtime: { async getBrowserInfo() { return { name: "Firefox" }; } },
      commands: {}
    }
  });
  const candidates = await platform.getBookmarksBarCandidates({});
  assert.deepEqual(JSON.parse(JSON.stringify(candidates)), [
    { id: "toolbar_____", title: "Bookmarks Toolbar", syncing: null }
  ]);
});

test("discovers account and local Chrome bookmarks bars from folderType", async () => {
  const chrome = {
    runtime: { getURL(path) { return `chrome-extension://test${path}`; } },
    bookmarks: {}
  };
  const platform = loadPlatform({ chrome });
  const bookmarks = {
    async getTree() {
      return [{
        id: "0",
        children: [
          { id: "local", title: "Bookmarks bar", folderType: "bookmarks-bar", syncing: false },
          { id: "account", title: "Bookmarks bar", folderType: "bookmarks-bar", syncing: true },
          { id: "other", title: "Other", folderType: "other", syncing: true }
        ]
      }];
    }
  };

  const candidates = await platform.getBookmarksBarCandidates(bookmarks);
  assert.deepEqual(JSON.parse(JSON.stringify(candidates)), [
    { id: "local", title: "Bookmarks bar", syncing: false },
    { id: "account", title: "Bookmarks bar", syncing: true }
  ]);
  const resolved = await platform.resolveBookmarksBar(bookmarks);
  assert.equal(resolved.id, "account");
});

test("constructs Chrome internal favicon URLs without external services", () => {
  const platform = loadPlatform({
    chrome: {
      runtime: { getURL(path) { return `chrome-extension://abcdefghijklmnop${path}`; } }
    }
  });
  const result = new URL(platform.getFaviconUrl("https://example.com/path?q=1", 16));
  assert.equal(result.protocol, "chrome-extension:");
  assert.equal(result.pathname, "/_favicon/");
  assert.equal(result.searchParams.get("pageUrl"), "https://example.com/path?q=1");
  assert.equal(result.searchParams.get("size"), "16");
});
