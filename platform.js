"use strict";

(function initializeBookmarkShortcutsPlatform(global) {
  const FIREFOX_BOOKMARKS_TOOLBAR_ID = "toolbar_____";
  const SETTINGS_DB_NAME = "bookmark-shortcuts-settings";
  const SETTINGS_STORE_NAME = "settings";
  const BOOKMARK_BAR_PREFERENCE_KEY = "chrome-bookmarks-bar-preference";

  const browserNamespace = global.browser;
  const chromeNamespace = global.chrome;
  const isFirefox = Boolean(
    browserNamespace && typeof browserNamespace.runtime?.getBrowserInfo === "function"
  );
  const isChrome = Boolean(chromeNamespace) && !isFirefox;
  const api = isChrome ? chromeNamespace : browserNamespace ?? chromeNamespace ?? null;

  function getNodeType(node) {
    if (!node) return "unknown";
    if (node.type === "separator") return "separator";
    if (node.type === "folder") return "folder";
    if (node.type === "bookmark") return "bookmark";
    if (typeof node.url === "string") return "bookmark";
    return "folder";
  }

  function flattenBookmarkTree(nodes, output = []) {
    for (const node of nodes ?? []) {
      output.push(node);
      if (Array.isArray(node.children)) {
        flattenBookmarkTree(node.children, output);
      }
    }
    return output;
  }

  async function getBookmarksBarCandidates(bookmarksApi = api?.bookmarks) {
    if (!bookmarksApi) return [];

    if (!isChrome) {
      return [{
        id: FIREFOX_BOOKMARKS_TOOLBAR_ID,
        title: "Bookmarks Toolbar",
        syncing: null
      }];
    }

    const roots = await bookmarksApi.getTree();
    return flattenBookmarkTree(roots)
      .filter((node) => node.folderType === "bookmarks-bar")
      .map((node) => ({
        id: node.id,
        title: node.title || "Bookmarks bar",
        syncing: Boolean(node.syncing)
      }));
  }

  function openSettingsDatabase() {
    if (!isChrome || typeof global.indexedDB === "undefined") {
      return Promise.resolve(null);
    }

    return new Promise((resolve, reject) => {
      const request = global.indexedDB.open(SETTINGS_DB_NAME, 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(SETTINGS_STORE_NAME)) {
          database.createObjectStore(SETTINGS_STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function readSetting(key) {
    const database = await openSettingsDatabase();
    if (!database) return null;

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(SETTINGS_STORE_NAME, "readonly");
      const request = transaction.objectStore(SETTINGS_STORE_NAME).get(key);
      request.onsuccess = () => {
        database.close();
        resolve(request.result ?? null);
      };
      request.onerror = () => {
        database.close();
        reject(request.error);
      };
    });
  }

  async function writeSetting(key, value) {
    const database = await openSettingsDatabase();
    if (!database) return false;

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(SETTINGS_STORE_NAME, "readwrite");
      transaction.objectStore(SETTINGS_STORE_NAME).put(value, key);
      transaction.oncomplete = () => {
        database.close();
        resolve(true);
      };
      transaction.onerror = () => {
        database.close();
        reject(transaction.error);
      };
    });
  }

  async function getBookmarkBarPreference() {
    return readSetting(BOOKMARK_BAR_PREFERENCE_KEY);
  }

  async function setBookmarkBarPreference(candidate) {
    if (!candidate?.id) return false;
    return writeSetting(BOOKMARK_BAR_PREFERENCE_KEY, {
      id: candidate.id,
      syncing: Boolean(candidate.syncing)
    });
  }

  async function resolveBookmarksBar(bookmarksApi = api?.bookmarks) {
    const candidates = await getBookmarksBarCandidates(bookmarksApi);
    if (candidates.length === 0) {
      throw new Error("Bookmarks bar was not found.");
    }
    if (candidates.length === 1) return candidates[0];

    const preference = await getBookmarkBarPreference();
    if (preference?.id) {
      const exact = candidates.find((candidate) => candidate.id === preference.id);
      if (exact) return exact;
    }
    if (typeof preference?.syncing === "boolean") {
      const sameSource = candidates.find(
        (candidate) => candidate.syncing === preference.syncing
      );
      if (sameSource) return sameSource;
    }

    return candidates.find((candidate) => candidate.syncing) ?? candidates[0];
  }

  async function getBookmarksBarData(bookmarksApi = api?.bookmarks) {
    const toolbar = await resolveBookmarksBar(bookmarksApi);
    const items = await bookmarksApi.getChildren(toolbar.id);
    return { toolbar, items };
  }

  function getFaviconUrl(pageUrl, size = 16) {
    if (!isChrome || !api?.runtime?.getURL || typeof pageUrl !== "string") {
      return null;
    }

    const url = new URL(api.runtime.getURL("/_favicon/"));
    url.searchParams.set("pageUrl", pageUrl);
    url.searchParams.set("size", String(size));
    return url.toString();
  }

  global.BookmarkShortcutsPlatform = Object.freeze({
    api,
    isChrome,
    isFirefox,
    getNodeType,
    getBookmarksBarCandidates,
    getBookmarkBarPreference,
    setBookmarkBarPreference,
    resolveBookmarksBar,
    getBookmarksBarData,
    getFaviconUrl
  });
})(globalThis);
