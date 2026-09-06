"use strict";

const BOOKMARKS_TOOLBAR_ID = "toolbar_____";
const COMMAND_PATTERN = /^open-bookmark(-new)?-(10|[1-9])$/;
const DEFAULT_ACTION_TITLE = "Bookmark Shortcuts";
const FEEDBACK_DURATION_MS = 900;
let feedbackGeneration = 0;
let folderPopupPort = null;
let folderPopupId = null;
let folderPopupRootId = null;

browser.runtime.onConnect.addListener((port) => {
  if (port.name !== "folder-popup") return;

  folderPopupPort = port;
  folderPopupId = null;
  folderPopupRootId = null;

  port.onMessage.addListener(async (message) => {
    if (message?.type === "folder-state" && typeof message.folderId === "string") {
      folderPopupId = message.folderId;
      folderPopupRootId =
        typeof message.rootFolderId === "string"
          ? message.rootFolderId
          : folderPopupRootId || message.folderId;
      return;
    }

    if (
      message?.type === "navigate-adjacent-root-folder" &&
      (message.direction === -1 || message.direction === 1)
    ) {
      try {
        await switchAdjacentToolbarFolder(message.direction);
      } catch (error) {
        console.error("Adjacent folder navigation failed:", error);
      }
    }
  });

  port.onDisconnect.addListener(() => {
    if (folderPopupPort === port) {
      folderPopupPort = null;
      folderPopupId = null;
      folderPopupRootId = null;
    }
  });
});

browser.commands.onCommand.addListener(async (command) => {
  try {
    const match = COMMAND_PATTERN.exec(command);
    if (!match) return;

    const openInNewTab = Boolean(match[1]);
    const position = Number(match[2]);
    const items = await browser.bookmarks.getChildren(BOOKMARKS_TOOLBAR_ID);
    const item = items[position - 1];
    if (!item) return;

    if (item.type === "folder") {
      await showFeedback(position, item, true);
      await openFolder(item.id);
      return;
    }

    if (typeof item.url !== "string") return;

    await showFeedback(position, item, false);
    if (openInNewTab) {
      await browser.tabs.create({ url: item.url });
      return;
    }
    await openUrlInCurrentTab(item.url);
  } catch (error) {
    console.error("Bookmark shortcut failed:", error);
  }
});

async function switchOpenPopupRootFolder(folderId, position = null, item = null) {
  if (!folderPopupPort) return false;
  if (folderPopupRootId === folderId) return true;

  const popupPath = `folder.html?id=${encodeURIComponent(folderId)}`;
  await browser.action.setPopup({ popup: popupPath });

  if (position !== null && item) {
    await showFeedback(position, item, true);
  }

  try {
    folderPopupPort.postMessage({
      type: "switch-folder",
      folderId,
      rootFolderId: folderId
    });
    folderPopupRootId = folderId;
    folderPopupId = folderId;
    return true;
  } catch (error) {
    folderPopupPort = null;
    folderPopupId = null;
    folderPopupRootId = null;
    return false;
  }
}

async function switchAdjacentToolbarFolder(direction) {
  if (!folderPopupPort || !folderPopupRootId || (direction !== -1 && direction !== 1)) {
    return false;
  }

  const items = await browser.bookmarks.getChildren(BOOKMARKS_TOOLBAR_ID);
  const currentIndex = items.findIndex(
    (item) => item.type === "folder" && item.id === folderPopupRootId
  );
  if (currentIndex < 0) return false;

  for (let index = currentIndex + direction; index >= 0 && index < items.length; index += direction) {
    const item = items[index];
    if (item.type !== "folder") continue;
    return switchOpenPopupRootFolder(item.id, index + 1, item);
  }

  return false;
}

async function openFolder(folderId) {
  if (folderPopupPort) {
    if (folderPopupRootId === folderId) return;
    if (await switchOpenPopupRootFolder(folderId)) return;
  }

  const popupPath = `folder.html?id=${encodeURIComponent(folderId)}`;
  await browser.action.setPopup({ popup: popupPath });

  try {
    await browser.action.openPopup();
  } catch (error) {
    const fullPagePath = `${popupPath}&view=tab`;
    await browser.tabs.create({ url: browser.runtime.getURL(fullPagePath) });
  }
}

async function openUrlInCurrentTab(url) {
  const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (activeTab?.pinned) {
    await browser.tabs.create({ url });
    return;
  }
  if (activeTab?.id !== undefined) {
    await browser.tabs.update(activeTab.id, { url });
  } else {
    await browser.tabs.update({ url });
  }
}

async function showFeedback(position, item, isFolder) {
  const generation = ++feedbackGeneration;
  const badge = isFolder ? `F${position}` : String(position);
  const title = item.title || (isFolder ? "Folder" : "Bookmark");

  await Promise.all([
    browser.action.setBadgeText({ text: badge }),
    browser.action.setTitle({ title: `${position}: ${title}` })
  ]);

  setTimeout(async () => {
    if (generation !== feedbackGeneration) return;
    try {
      await Promise.all([
        browser.action.setBadgeText({ text: "" }),
        browser.action.setTitle({ title: DEFAULT_ACTION_TITLE })
      ]);
    } catch (error) {
      console.error("Bookmark feedback reset failed:", error);
    }
  }, FEEDBACK_DURATION_MS);
}
