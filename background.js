"use strict";

const BOOKMARKS_TOOLBAR_ID = "toolbar_____";
const COMMAND_PATTERN = /^open-bookmark(-new)?-(10|[1-9])$/;

browser.commands.onCommand.addListener(async (command) => {
  try {
    const match = COMMAND_PATTERN.exec(command);
    if (!match) {
      return;
    }

    const openInNewTab = Boolean(match[1]);
    const index = Number(match[2]) - 1;
    const items = await browser.bookmarks.getChildren(BOOKMARKS_TOOLBAR_ID);
    const item = items[index];

    // Keep shortcut numbering aligned with the visible order on the toolbar.
    // Folders and separators occupy a position but are not opened.
    if (!item || typeof item.url !== "string") {
      return;
    }

    if (openInNewTab) {
      await browser.tabs.create({ url: item.url });
      return;
    }

    const [activeTab] = await browser.tabs.query({
      active: true,
      currentWindow: true
    });

    // Do not replace a pinned tab. Open the bookmark in a new tab instead.
    if (activeTab?.pinned) {
      await browser.tabs.create({ url: item.url });
      return;
    }

    if (activeTab?.id !== undefined) {
      await browser.tabs.update(activeTab.id, { url: item.url });
    } else {
      await browser.tabs.update({ url: item.url });
    }
  } catch (error) {
    console.error("Bookmark shortcut failed:", error);
  }
});
