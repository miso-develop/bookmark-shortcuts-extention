"use strict";

if (!globalThis.BookmarkShortcutsPlatform && typeof importScripts === "function") {
  importScripts("platform.js");
}

const platform = globalThis.BookmarkShortcutsPlatform;
const extensionApi = platform?.api;
const COMMAND_PATTERN = /^open-bookmark(-new)?-(10|[1-9])$/;
const DEFAULT_ACTION_TITLE = "Bookmark Shortcuts";
const FEEDBACK_DURATION_MS = 900;
const DUPLICATE_SHORTCUT_WINDOW_MS = 100;

const DEFAULT_SHORTCUTS = Object.fromEntries(
  Array.from({ length: 10 }, (_, index) => {
    const position = index + 1;
    const key = position === 10 ? "0" : String(position);
    return [
      [`open-bookmark-${position}`, `Alt+${key}`],
      [`open-bookmark-new-${position}`, `Alt+Shift+${key}`]
    ];
  }).flat()
);

let feedbackGeneration = 0;
let lastShortcutRequest = null;

if (!extensionApi || !platform) {
  throw new Error("Bookmark Shortcuts platform initialization failed.");
}

extensionApi.commands.onCommand.addListener(async (command) => {
  try {
    const match = COMMAND_PATTERN.exec(command);
    if (!match) return;
    await requestToolbarShortcut(Number(match[2]), Boolean(match[1]));
  } catch (error) {
    console.error("Bookmark shortcut failed:", error);
  }
});

if (typeof extensionApi.commands?.update === "function") {
  repairMissingShortcuts().catch((error) => {
    console.error("Shortcut repair failed:", error);
  });
}

async function repairMissingShortcuts() {
  if (
    typeof extensionApi.commands?.getAll !== "function" ||
    typeof extensionApi.commands?.update !== "function"
  ) {
    return;
  }

  const commands = await extensionApi.commands.getAll();
  for (const command of commands) {
    const expectedShortcut = DEFAULT_SHORTCUTS[command.name];
    if (!expectedShortcut || command.shortcut) continue;

    try {
      await extensionApi.commands.update({
        name: command.name,
        shortcut: expectedShortcut
      });
    } catch (error) {
      console.error(`Failed to restore shortcut ${command.name}:`, error);
    }
  }
}

async function requestToolbarShortcut(position, openInNewTab = false) {
  const now = Date.now();
  const requestKey = `${position}:${openInNewTab ? 1 : 0}`;

  if (
    lastShortcutRequest?.key === requestKey &&
    now - lastShortcutRequest.at < DUPLICATE_SHORTCUT_WINDOW_MS
  ) {
    return false;
  }

  lastShortcutRequest = { key: requestKey, at: now };
  await executeToolbarShortcut(position, openInNewTab);
  return true;
}

async function executeToolbarShortcut(position, openInNewTab = false) {
  if (!Number.isInteger(position) || position < 1 || position > 10) return;

  const { items } = await platform.getBookmarksBarData(extensionApi.bookmarks);
  const item = items[position - 1];
  if (!item) return;

  const itemType = platform.getNodeType(item);
  if (itemType === "folder") {
    await showFeedback(position, item, true);
    await openFolder(item.id, position);
    return;
  }

  if (itemType !== "bookmark" || typeof item.url !== "string") return;

  await showFeedback(position, item, false);
  if (openInNewTab) {
    await extensionApi.tabs.create({ url: item.url });
    return;
  }

  await openUrlInCurrentTab(item.url);
}

function buildFolderPopupPath(folderId, position) {
  const params = new URLSearchParams({ id: folderId });
  if (Number.isInteger(position) && position > 0) {
    params.set("position", String(position));
  }
  return `folder.html?${params.toString()}`;
}

async function openFolder(folderId, position) {
  const popupPath = buildFolderPopupPath(folderId, position);
  await extensionApi.action.setPopup({ popup: popupPath });

  try {
    await extensionApi.action.openPopup();
  } catch (error) {
    const separator = popupPath.includes("?") ? "&" : "?";
    const fullPagePath = `${popupPath}${separator}view=tab`;
    await extensionApi.tabs.create({ url: extensionApi.runtime.getURL(fullPagePath) });
  }
}

async function openUrlInCurrentTab(url) {
  const [activeTab] = await extensionApi.tabs.query({ active: true, currentWindow: true });
  if (activeTab?.pinned) {
    await extensionApi.tabs.create({ url });
    return;
  }
  if (activeTab?.id !== undefined) {
    await extensionApi.tabs.update(activeTab.id, { url });
  } else {
    await extensionApi.tabs.update({ url });
  }
}

async function showFeedback(position, item, isFolder) {
  const generation = ++feedbackGeneration;
  const badge = isFolder ? `F${position}` : String(position);
  const title = item.title || (isFolder ? "Folder" : "Bookmark");

  await Promise.all([
    extensionApi.action.setBadgeText({ text: badge }),
    extensionApi.action.setTitle({ title: `${position}: ${title}` })
  ]);

  setTimeout(async () => {
    if (generation !== feedbackGeneration) return;
    try {
      await Promise.all([
        extensionApi.action.setBadgeText({ text: "" }),
        extensionApi.action.setTitle({ title: DEFAULT_ACTION_TITLE })
      ]);
    } catch (error) {
      console.error("Bookmark feedback reset failed:", error);
    }
  }, FEEDBACK_DURATION_MS);
}
