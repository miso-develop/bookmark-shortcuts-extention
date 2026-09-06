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

export function nextSelectionIndex(currentIndex, itemCount, direction) {
  if (itemCount <= 0) {
    return -1;
  }

  if (currentIndex < 0 || currentIndex >= itemCount) {
    return direction < 0 ? itemCount - 1 : 0;
  }

  return (currentIndex + direction + itemCount) % itemCount;
}

export function getKeyboardAction(key) {
  switch (key) {
    case "ArrowDown":
      return "next";
    case "ArrowUp":
      return "previous";
    case "Enter":
      return "activate";
    case "ArrowLeft":
    case "Backspace":
      return "back";
    default:
      return null;
  }
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

  const initialFolderId = new URLSearchParams(window.location.search).get("id");
  const history = [];
  let selectableItems = [];
  let selectedIndex = -1;

  function setSelectedIndex(index, { focus = true } = {}) {
    for (const item of selectableItems) {
      item.classList.remove("keyboard-selected");
    }

    selectedIndex = index;
    const selected = selectableItems[selectedIndex];
    if (!selected) {
      return;
    }

    selected.classList.add("keyboard-selected");
    if (focus) {
      selected.focus({ preventScroll: true });
      selected.scrollIntoView({ block: "nearest" });
    }
  }

  function refreshSelectableItems() {
    selectableItems = Array.from(itemsContainer.querySelectorAll(".item:not(:disabled)"));

    selectableItems.forEach((item, index) => {
      item.addEventListener("mouseenter", () => {
        setSelectedIndex(index, { focus: false });
      });
    });

    if (selectableItems.length > 0) {
      setSelectedIndex(0);
    } else {
      selectedIndex = -1;
    }
  }

  async function render(folderId, { pushHistory = true } = {}) {
    if (!folderId) {
      return;
    }

    try {
      const { folder, items } = await getFolderData(browser.bookmarks, folderId);

      if (pushHistory && history.at(-1) !== folder.id) {
        history.push(folder.id);
      }

      title.textContent = folder.title || "(無題のフォルダ)";
      subtitle.textContent = `${items.length} 件 · ↑↓で選択 / Enterで開く`;
      message.hidden = true;
      itemsContainer.hidden = false;
      itemsContainer.replaceChildren();

      upButton.hidden = history.length <= 1;

      if (items.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty";
        empty.textContent = "このフォルダは空です。";
        itemsContainer.append(empty);
        refreshSelectableItems();
        return;
      }

      for (const item of items) {
        if (item.type === "separator") {
          itemsContainer.append(document.createElement("hr"));
          continue;
        }

        itemsContainer.append(createItemButton(item, (childFolderId) => {
          render(childFolderId, { pushHistory: true });
        }));
      }

      refreshSelectableItems();
    } catch (error) {
      console.error("Failed to open bookmark folder:", error);
      title.textContent = "フォルダを開けませんでした";
      subtitle.textContent = "";
      message.textContent = String(error);
      message.hidden = false;
      itemsContainer.hidden = true;
      selectableItems = [];
      selectedIndex = -1;
    }
  }

  async function goBack() {
    if (history.length <= 1) {
      return false;
    }

    history.pop();
    await render(history.at(-1), { pushHistory: false });
    return true;
  }

  upButton.addEventListener("click", () => {
    goBack();
  });

  document.addEventListener("keydown", async (event) => {
    const action = getKeyboardAction(event.key);
    if (!action) {
      return;
    }

    if (action === "next" || action === "previous") {
      event.preventDefault();
      const direction = action === "next" ? 1 : -1;
      setSelectedIndex(nextSelectionIndex(selectedIndex, selectableItems.length, direction));
      return;
    }

    if (action === "activate") {
      const selected = selectableItems[selectedIndex];
      if (!selected) {
        return;
      }

      event.preventDefault();
      selected.click();
      return;
    }

    if (action === "back" && history.length > 1) {
      event.preventDefault();
      await goBack();
    }
  });

  if (initialFolderId) {
    await render(initialFolderId, { pushHistory: true });
  }
}

if (typeof window !== "undefined" && typeof document !== "undefined" && typeof browser !== "undefined") {
  initializeFolderView().catch((error) => {
    console.error("Failed to initialize bookmark folder view:", error);
  });
}
