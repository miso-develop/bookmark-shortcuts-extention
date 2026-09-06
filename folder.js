const BOOKMARKS_TOOLBAR_ID = "toolbar_____";

export async function getFolderData(bookmarksApi, folderId) {
  const [folder] = await bookmarksApi.get(folderId);
  if (!folder || folder.type !== "folder") {
    throw new Error(`Bookmark folder not found: ${folderId}`);
  }

  const items = await bookmarksApi.getChildren(folderId);
  return { folder, items };
}

export async function openBookmarkUrl(tabsApi, url) {
  const [activeTab] = await tabsApi.query({ active: true, currentWindow: true });

  if (activeTab?.pinned) {
    await tabsApi.create({ url });
    return "new-tab";
  }

  if (activeTab?.id !== undefined) {
    await tabsApi.update(activeTab.id, { url });
  } else {
    await tabsApi.update({ url });
  }

  return "current-tab";
}

function createItemButton(item, onFolderOpen) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "item";

  const icon = document.createElement("span");
  icon.className = "item-icon";
  icon.textContent = item.type === "folder" ? "📁" : "🔖";

  const label = document.createElement("span");
  label.className = "item-label";
  label.textContent = item.title || item.url || "(無題)";

  button.append(icon, label);

  if (item.type === "folder") {
    const chevron = document.createElement("span");
    chevron.className = "item-chevron";
    chevron.textContent = "›";
    button.append(chevron);
    button.addEventListener("click", () => onFolderOpen(item.id));
    return button;
  }

  if (typeof item.url === "string") {
    button.addEventListener("click", async () => {
      await openBookmarkUrl(browser.tabs, item.url);
      window.close();
    });
    return button;
  }

  button.disabled = true;
  return button;
}

async function initializeFolderView() {
  const title = document.getElementById("folder-title");
  const subtitle = document.getElementById("folder-subtitle");
  const upButton = document.getElementById("up");
  const message = document.getElementById("message");
  const itemsContainer = document.getElementById("items");

  let currentFolderId = new URLSearchParams(window.location.search).get("id");

  async function render(folderId) {
    if (!folderId) {
      return;
    }

    try {
      const { folder, items } = await getFolderData(browser.bookmarks, folderId);
      currentFolderId = folder.id;

      title.textContent = folder.title || "(無題のフォルダ)";
      subtitle.textContent = `${items.length} 件`;
      message.hidden = true;
      itemsContainer.hidden = false;
      itemsContainer.replaceChildren();

      upButton.hidden = !folder.parentId;
      upButton.dataset.parentId = folder.parentId || "";

      if (items.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty";
        empty.textContent = "このフォルダは空です。";
        itemsContainer.append(empty);
        return;
      }

      for (const item of items) {
        if (item.type === "separator") {
          itemsContainer.append(document.createElement("hr"));
          continue;
        }

        itemsContainer.append(createItemButton(item, render));
      }
    } catch (error) {
      console.error("Failed to open bookmark folder:", error);
      title.textContent = "フォルダを開けませんでした";
      subtitle.textContent = "";
      message.textContent = String(error);
      message.hidden = false;
      itemsContainer.hidden = true;
    }
  }

  upButton.addEventListener("click", async () => {
    if (!currentFolderId) {
      return;
    }

    const [folder] = await browser.bookmarks.get(currentFolderId);
    if (!folder?.parentId || folder.parentId === BOOKMARKS_TOOLBAR_ID) {
      window.close();
      return;
    }

    await render(folder.parentId);
  });

  if (currentFolderId) {
    await render(currentFolderId);
  }
}

if (typeof window !== "undefined" && typeof document !== "undefined" && typeof browser !== "undefined") {
  initializeFolderView().catch((error) => {
    console.error("Failed to initialize bookmark folder view:", error);
  });
}
