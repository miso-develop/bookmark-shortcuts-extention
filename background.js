"use strict";

const BOOKMARKS_TOOLBAR_ID = "toolbar_____";
const COMMAND_PATTERN = /^open-bookmark(-new)?-(10|[1-9])$/;
const DEFAULT_ACTION_TITLE = "Bookmark Shortcuts";
const FEEDBACK_DURATION_MS = 900;
let feedbackGeneration = 0;

browser.commands.onCommand.addListener(async (command) => {
  try {
    const match = COMMAND_PATTERN.exec(command);
    if (!match) {
      return;
    }

    const openInNewTab = Boolean(match[1]);
    const position = Number(match[2]);
    const index = position - 1;
    const items = await browser.bookmarks.getChildren(BOOKMARKS_TOOLBAR_ID);
    const item = items[index];

    if (!item) {
      return;
    }

    if (item.type === "folder") {
      await showFeedback(position, item, true);
      await openFolder(item.id);
      return;
    }

    if (typeof item.url !== "string") {
      return;
    }

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

async function openFolder(folderId) {
  const popupPath = `folder.html?id=${encodeURIComponent(folderId)}`;
  await browser.action.setPopup({ popup: popupPath });

  try {
    await browser.action.openPopup();
  } catch (error) {
    // Some Firefox configurations may prevent a programmatic popup. Keep the
    // shortcut functional by falling back to the same folder view in a tab.
    await browser.tabs.create({ url: browser.runtime.getURL(popupPath) });
  }
}

async function openUrlInCurrentTab(url) {
  const [activeTab] = await browser.tabs.query({
    active: true,
    currentWindow: true
  });

  // Do not replace a pinned tab. Open the bookmark in a new tab instead.
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
    if (generation !== feedbackGeneration) {
      return;
    }

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
