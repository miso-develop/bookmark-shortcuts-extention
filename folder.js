const BOOKMARKS_TOOLBAR_ID = "toolbar_____";
const ALWAYS_NEW_TAB_KEY = "always-new-tab";

export async function getFolderData(bookmarksApi, folderId) {
  const [folder] = await bookmarksApi.get(folderId);
  if (!folder || folder.type !== "folder") {
    throw new Error(`Bookmark folder not found: ${folderId}`);
  }

  const items = await bookmarksApi.getChildren(folderId);
  return { folder, items };
}

export async function openBookmarkUrl(tabsApi, url, { forceNewTab = false } = {}) {
  if (forceNewTab) {
    await tabsApi.create({ url });
    return "new-tab";
  }

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

export function pageSelectionIndex(currentIndex, itemCount, pageSize, direction) {
  if (itemCount <= 0) {
    return -1;
  }

  const step = Math.max(1, Math.floor(pageSize) || 1);
  if (currentIndex < 0 || currentIndex >= itemCount) {
    return direction < 0 ? itemCount - 1 : 0;
  }

  return Math.min(itemCount - 1, Math.max(0, currentIndex + direction * step));
}

export function getKeyboardAction(key, { ctrlKey = false } = {}) {
  switch (key) {
    case "ArrowDown":
      return "next";
    case "ArrowUp":
      return "previous";
    case "PageDown":
      return "page-next";
    case "PageUp":
      return "page-previous";
    case "Enter":
      return ctrlKey ? "activate-new-tab" : "activate";
    case "ArrowLeft":
    case "Backspace":
      return "back";
    default:
      return null;
  }
}

export function shouldOpenInNewTab({ ctrlKey = false, alwaysNewTab = false } = {}) {
  return ctrlKey || alwaysNewTab;
}

function createItemButton(item) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "item";
  button.dataset.itemType = item.type;

  const icon = document.createElement("span");
  icon.className = "item-icon";
  icon.textContent = item.type === "folder" ? "📁" : "🔖";

  const label = document.createElement("span");
  label.className = "item-label";
  label.textContent = item.title || item.url || "(無題)";

  button.append(icon, label);

  if (item.type === "folder") {
    button.dataset.folderId = item.id;
    const chevron = document.createElement("span");
    chevron.className = "item-chevron";
    chevron.textContent = "›";
    button.append(chevron);
    return button;
  }

  if (typeof item.url === "string") {
    button.dataset.url = item.url;
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
  const main = document.querySelector("main");
  const alwaysNewTabCheckbox = document.getElementById("always-new-tab");

  const initialFolderId = new URLSearchParams(window.location.search).get("id");
  const history = [];
  let selectableItems = [];
  let selectedIndex = -1;

  alwaysNewTabCheckbox.checked = localStorage.getItem(ALWAYS_NEW_TAB_KEY) === "true";
  alwaysNewTabCheckbox.addEventListener("change", () => {
    localStorage.setItem(ALWAYS_NEW_TAB_KEY, String(alwaysNewTabCheckbox.checked));
  });

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

  function getPageSize() {
    const selected = selectableItems[selectedIndex] || selectableItems[0];
    if (!selected) {
      return 1;
    }

    const itemHeight = Math.max(1, selected.getBoundingClientRect().height || selected.offsetHeight || 1);
    const viewportHeight = Math.max(1, main?.clientHeight || window.innerHeight || itemHeight);
    return Math.max(1, Math.floor(viewportHeight / itemHeight));
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

  async function activateItem(item, { forceNewTab = false } = {}) {
    if (!item) {
      return;
    }

    if (item.dataset.itemType === "folder" && item.dataset.folderId) {
      await render(item.dataset.folderId, { pushHistory: true });
      return;
    }

    if (item.dataset.url) {
      await openBookmarkUrl(browser.tabs, item.dataset.url, {
        forceNewTab: shouldOpenInNewTab({
          ctrlKey: forceNewTab,
          alwaysNewTab: alwaysNewTabCheckbox.checked
        })
      });
      window.close();
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
      subtitle.textContent = `${items.length} 件 · ↑↓/PgUp/PgDnで選択 · Enterで開く`;
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

        const button = createItemButton(item);
        button.addEventListener("click", (event) => {
          activateItem(button, { forceNewTab: event.ctrlKey });
        });
        itemsContainer.append(button);
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
    const action = getKeyboardAction(event.key, { ctrlKey: event.ctrlKey });
    if (!action) {
      return;
    }

    if (action === "next" || action === "previous") {
      event.preventDefault();
      const direction = action === "next" ? 1 : -1;
      setSelectedIndex(nextSelectionIndex(selectedIndex, selectableItems.length, direction));
      return;
    }

    if (action === "page-next" || action === "page-previous") {
      event.preventDefault();
      const direction = action === "page-next" ? 1 : -1;
      setSelectedIndex(
        pageSelectionIndex(selectedIndex, selectableItems.length, getPageSize(), direction)
      );
      return;
    }

    if (action === "activate" || action === "activate-new-tab") {
      const selected = selectableItems[selectedIndex];
      if (!selected) {
        return;
      }

      event.preventDefault();
      await activateItem(selected, { forceNewTab: action === "activate-new-tab" });
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
