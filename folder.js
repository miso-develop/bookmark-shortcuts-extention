import { parsePopupShortcut } from "./popup-shortcuts.js";

const ALWAYS_NEW_TAB_KEY = "always-new-tab";
const FIXED_ARROW_JUMP = 5;

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
  if (itemCount <= 0) return -1;
  if (currentIndex < 0 || currentIndex >= itemCount) {
    return direction < 0 ? itemCount - 1 : 0;
  }
  return (currentIndex + direction + itemCount) % itemCount;
}

export function pageSelectionIndex(currentIndex, itemCount, pageSize, direction) {
  if (itemCount <= 0) return -1;
  const step = Math.max(1, Math.floor(pageSize) || 1);
  if (currentIndex < 0 || currentIndex >= itemCount) {
    return direction < 0 ? itemCount - 1 : 0;
  }
  return Math.min(itemCount - 1, Math.max(0, currentIndex + direction * step));
}

export function findFolderSelectionIndex(items, folderId) {
  if (!folderId) return -1;
  return items.findIndex((item) => item?.dataset?.folderId === folderId);
}

export function getKeyboardAction(
  key,
  { ctrlKey = false, altKey = false, shiftKey = false } = {}
) {
  if (altKey && (key === "Tab" || key === "Enter")) {
    return "open-full-page";
  }

  switch (key) {
    case "ArrowDown":
      return shiftKey ? "jump-next-5" : "next";
    case "ArrowUp":
      return shiftKey ? "jump-previous-5" : "previous";
    case "ArrowLeft":
      return "left";
    case "ArrowRight":
      return "right";
    case "PageDown":
      return shiftKey ? "half-page-next" : "page-next";
    case "PageUp":
      return shiftKey ? "half-page-previous" : "page-previous";
    case "Home":
      return "first";
    case "End":
      return "last";
    case "Enter":
      return ctrlKey ? "activate-new-tab" : "activate";
    case "Backspace":
      return "back";
    default:
      return null;
  }
}

export function shouldOpenInNewTab({ ctrlKey = false, alwaysNewTab = false } = {}) {
  return ctrlKey || alwaysNewTab;
}

export function buildFolderViewPath(folderId, { fullPage = false } = {}) {
  const path = `folder.html?id=${encodeURIComponent(folderId)}`;
  return fullPage ? `${path}&view=tab` : path;
}

function createItemButton(item) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "item";
  button.dataset.itemType = item.type;

  const icon = document.createElement("span");
  icon.className = "item-icon";
  icon.textContent = item.type === "folder" ? "📁" : "🔖";
  icon.setAttribute("aria-hidden", "true");

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

  const params = new URLSearchParams(window.location.search);
  const initialFolderId = params.get("id");
  const fullPageView = params.get("view") === "tab";
  const popupPort = fullPageView ? null : browser.runtime.connect({ name: "folder-popup" });
  const shortcutProxyPort = fullPageView
    ? null
    : browser.runtime.connect({ name: "shortcut-proxy" });

  if (fullPageView) {
    document.body.classList.add("full-page");
  }

  const history = [];
  let rootFolderId = initialFolderId;
  let currentFolderId = null;
  let selectableItems = [];
  let selectedIndex = -1;
  let keyboardNavigationActive = false;

  function setKeyboardNavigation(active) {
    keyboardNavigationActive = active;
    document.body.classList.toggle("keyboard-navigation", active);
  }

  function clearSelection() {
    for (const item of selectableItems) {
      item.classList.remove("keyboard-selected");
    }
    selectedIndex = -1;
  }

  function setSelectedIndex(index, { focus = true } = {}) {
    for (const item of selectableItems) {
      item.classList.remove("keyboard-selected");
    }

    selectedIndex = index;
    const selected = selectableItems[selectedIndex];
    if (!selected) {
      selectedIndex = -1;
      return;
    }

    selected.classList.add("keyboard-selected");
    if (focus && document.activeElement !== selected) {
      selected.focus({ preventScroll: true });
      selected.scrollIntoView({ block: "nearest" });
    }
  }

  function getPageSize() {
    const selected = selectableItems[selectedIndex] || selectableItems[0];
    if (!selected) return 1;
    const itemHeight = Math.max(1, selected.getBoundingClientRect().height || selected.offsetHeight || 1);
    const viewportHeight = Math.max(1, main?.clientHeight || window.innerHeight || itemHeight);
    return Math.max(1, Math.floor(viewportHeight / itemHeight));
  }

  function refreshSelectableItems({ focusFolderId = null } = {}) {
    selectableItems = Array.from(itemsContainer.querySelectorAll(".item:not(:disabled)"));

    selectableItems.forEach((item, index) => {
      item.addEventListener("pointermove", () => {
        setKeyboardNavigation(false);
        setSelectedIndex(index, { focus: true });
      });
      item.addEventListener("focus", () => {
        setSelectedIndex(index, { focus: false });
      });
    });

    if (selectableItems.length === 0) {
      clearSelection();
      return;
    }

    const restoredIndex = findFolderSelectionIndex(selectableItems, focusFolderId);
    setSelectedIndex(restoredIndex >= 0 ? restoredIndex : 0);
  }

  function alwaysOpenInNewTab() {
    return localStorage.getItem(ALWAYS_NEW_TAB_KEY) === "true";
  }

  async function activateItem(item, { forceNewTab = false } = {}) {
    if (!item) return;

    if (item.dataset.itemType === "folder" && item.dataset.folderId) {
      await render(item.dataset.folderId, { pushHistory: true });
      return;
    }

    if (item.dataset.url) {
      await openBookmarkUrl(browser.tabs, item.dataset.url, {
        forceNewTab: shouldOpenInNewTab({
          ctrlKey: forceNewTab,
          alwaysNewTab: alwaysOpenInNewTab()
        })
      });
      window.close();
    }
  }

  async function render(
    folderId,
    { pushHistory = true, resetHistory = false, focusFolderId = null } = {}
  ) {
    if (!folderId) return;

    try {
      const { folder, items } = await getFolderData(browser.bookmarks, folderId);

      if (resetHistory) history.splice(0, history.length);
      if (pushHistory && history.at(-1) !== folder.id) history.push(folder.id);

      currentFolderId = folder.id;
      title.textContent = folder.title || "(無題のフォルダ)";
      subtitle.textContent = `${items.length} 件 · ↑↓/Shift+↑↓/PgUp/PgDn/Home/Endで選択 · Enterで開く`;
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
      } else {
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
        refreshSelectableItems({ focusFolderId });
      }

      popupPort?.postMessage({
        type: "folder-state",
        folderId: currentFolderId,
        rootFolderId
      });
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
    if (history.length <= 1) return false;
    const childFolderId = history.pop();
    await render(history.at(-1), { pushHistory: false, focusFolderId: childFolderId });
    return true;
  }

  async function openFullPageView() {
    if (!currentFolderId || fullPageView) return false;
    const path = buildFolderViewPath(currentFolderId, { fullPage: true });
    await browser.tabs.create({ url: browser.runtime.getURL(path) });
    window.close();
    return true;
  }

  function navigateAdjacentRootFolder(direction) {
    if (fullPageView || !popupPort || history.length !== 1) return false;
    popupPort.postMessage({ type: "navigate-adjacent-root-folder", direction });
    return true;
  }

  upButton.addEventListener("click", () => {
    goBack();
  });

  document.addEventListener("focusin", (event) => {
    if (!(event.target instanceof Element) || !event.target.closest(".item")) {
      clearSelection();
    }
  });

  window.addEventListener("keydown", async (event) => {
    if (event.key === "Escape") {
      return;
    }

    const plainTab =
      event.key === "Tab" && !event.ctrlKey && !event.altKey && !event.metaKey;
    const popupShortcut = fullPageView ? null : parsePopupShortcut(event);
    const action = getKeyboardAction(event.key, {
      ctrlKey: event.ctrlKey,
      altKey: event.altKey,
      shiftKey: event.shiftKey
    });

    if (!fullPageView) {
      setKeyboardNavigation(true);
      if (plainTab) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
    } else if (popupShortcut || action) {
      setKeyboardNavigation(true);
      event.preventDefault();
      event.stopImmediatePropagation();
    } else {
      return;
    }

    if (popupShortcut && shortcutProxyPort) {
      shortcutProxyPort.postMessage({
        type: "invoke-toolbar-shortcut",
        position: popupShortcut.position,
        openInNewTab: popupShortcut.openInNewTab
      });
      return;
    }

    if (!action) {
      return;
    }

    if (action === "open-full-page") {
      await openFullPageView();
      return;
    }

    if (action === "left") {
      if (history.length === 1) {
        navigateAdjacentRootFolder(-1);
      }
      return;
    }

    if (action === "right") {
      navigateAdjacentRootFolder(1);
      return;
    }

    if (action === "next" || action === "previous") {
      const direction = action === "next" ? 1 : -1;
      setSelectedIndex(nextSelectionIndex(selectedIndex, selectableItems.length, direction));
      return;
    }

    if (action === "jump-next-5" || action === "jump-previous-5") {
      const direction = action === "jump-next-5" ? 1 : -1;
      setSelectedIndex(
        pageSelectionIndex(selectedIndex, selectableItems.length, FIXED_ARROW_JUMP, direction)
      );
      return;
    }

    if (
      action === "page-next" || action === "page-previous" ||
      action === "half-page-next" || action === "half-page-previous"
    ) {
      const direction = action.endsWith("next") ? 1 : -1;
      const pageSize = getPageSize();
      const step = action.startsWith("half-page")
        ? Math.max(1, Math.ceil(pageSize / 2))
        : pageSize;
      setSelectedIndex(pageSelectionIndex(selectedIndex, selectableItems.length, step, direction));
      return;
    }

    if (action === "first" || action === "last") {
      setSelectedIndex(action === "first" ? 0 : selectableItems.length - 1);
      return;
    }

    if (action === "activate" || action === "activate-new-tab") {
      const selected = selectableItems[selectedIndex];
      if (!selected) return;
      await activateItem(selected, { forceNewTab: action === "activate-new-tab" });
      return;
    }

    if (action === "back" && history.length > 1) {
      await goBack();
    }
  }, true);

  popupPort?.onMessage.addListener((message) => {
    if (message?.type !== "switch-folder" || typeof message.folderId !== "string") return;

    const nextRootFolderId =
      typeof message.rootFolderId === "string" ? message.rootFolderId : message.folderId;

    if (message.folderId === currentFolderId && nextRootFolderId === rootFolderId) return;

    rootFolderId = nextRootFolderId;
    render(message.folderId, { pushHistory: true, resetHistory: true });
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
