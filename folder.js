import { parsePopupShortcut } from "./popup-shortcuts.js";

const ALWAYS_NEW_TAB_KEY = "always-new-tab";
const FIXED_ARROW_JUMP = 5;

const fallbackGetNodeType = (node) => {
  if (!node) return "unknown";
  if (node.type === "separator") return "separator";
  if (node.type === "folder") return "folder";
  if (node.type === "bookmark") return "bookmark";
  return typeof node.url === "string" ? "bookmark" : "folder";
};

const platform = globalThis.BookmarkShortcutsPlatform ?? {
  api: globalThis.browser ?? globalThis.chrome ?? null,
  isChrome: Boolean(globalThis.chrome && !globalThis.browser),
  getNodeType: fallbackGetNodeType,
  getFaviconUrl: () => null
};
const extensionApi = platform.api;

export async function getFolderData(bookmarksApi, folderId) {
  const [folder] = await bookmarksApi.get(folderId);
  if (!folder || platform.getNodeType(folder) !== "folder") {
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

export function buildFolderViewPath(
  folderId,
  { fullPage = false, position = null } = {}
) {
  const params = new URLSearchParams({ id: folderId });
  if (Number.isInteger(position) && position > 0) {
    params.set("position", String(position));
  }
  if (fullPage) {
    params.set("view", "tab");
  }
  return `folder.html?${params.toString()}`;
}

function createItemButton(item) {
  const itemType = platform.getNodeType(item);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "item";
  button.dataset.itemType = itemType;

  const icon = document.createElement("span");
  icon.className = "item-icon";
  icon.setAttribute("aria-hidden", "true");

  if (itemType === "folder") {
    icon.textContent = "📁";
  } else {
    const faviconUrl = platform.getFaviconUrl?.(item.url, 16);
    if (faviconUrl) {
      const image = document.createElement("img");
      image.src = faviconUrl;
      image.alt = "";
      image.width = 16;
      image.height = 16;
      icon.append(image);
    } else {
      icon.textContent = "🔖";
    }
  }

  const label = document.createElement("span");
  label.className = "item-label";
  label.textContent = item.title || item.url || "(無題)";

  button.append(icon, label);

  if (itemType === "folder") {
    button.dataset.folderId = item.id;
    const chevron = document.createElement("span");
    chevron.className = "item-chevron";
    chevron.textContent = "›";
    button.append(chevron);
    return button;
  }

  if (itemType === "bookmark" && typeof item.url === "string") {
    button.dataset.url = item.url;
    return button;
  }

  button.disabled = true;
  return button;
}

function parsePositiveInteger(value) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function initializeFolderView() {
  const title = document.getElementById("folder-title");
  const subtitle = document.getElementById("folder-subtitle");
  const upButton = document.getElementById("up");
  const rootPositionElement = document.getElementById("root-position");
  const message = document.getElementById("message");
  const itemsContainer = document.getElementById("items");
  const main = document.querySelector("main");

  const params = new URLSearchParams(window.location.search);
  const initialFolderId = params.get("id");
  const fullPageView = params.get("view") === "tab";

  if (!extensionApi) {
    throw new Error("WebExtension API is unavailable.");
  }

  if (fullPageView) {
    document.body.classList.add("full-page");
  }

  const history = [];
  let rootFolderId = initialFolderId;
  let rootPosition = parsePositiveInteger(params.get("position"));
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
    const itemHeight = Math.max(
      1,
      selected.getBoundingClientRect().height || selected.offsetHeight || 1
    );
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

  function updateRootPositionLabel() {
    if (!rootPositionElement) return;
    if (Number.isInteger(rootPosition) && rootPosition > 0) {
      rootPositionElement.textContent = `F${rootPosition}`;
      rootPositionElement.hidden = false;
    } else {
      rootPositionElement.textContent = "";
      rootPositionElement.hidden = true;
    }
  }

  async function updateActionPopup() {
    if (fullPageView || !rootFolderId || !extensionApi.action?.setPopup) return;
    await extensionApi.action.setPopup({
      popup: buildFolderViewPath(rootFolderId, { position: rootPosition })
    });
  }

  async function activateItem(item, { forceNewTab = false } = {}) {
    if (!item) return;

    if (item.dataset.itemType === "folder" && item.dataset.folderId) {
      await render(item.dataset.folderId, { pushHistory: true });
      return;
    }

    if (item.dataset.url) {
      await openBookmarkUrl(extensionApi.tabs, item.dataset.url, {
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
      const { folder, items } = await getFolderData(extensionApi.bookmarks, folderId);

      if (resetHistory) history.splice(0, history.length);
      if (pushHistory && history.at(-1) !== folder.id) history.push(folder.id);

      currentFolderId = folder.id;
      updateRootPositionLabel();
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
          if (platform.getNodeType(item) === "separator") {
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
    const path = buildFolderViewPath(currentFolderId, {
      fullPage: true,
      position: rootPosition
    });
    await extensionApi.tabs.create({ url: extensionApi.runtime.getURL(path) });
    window.close();
    return true;
  }

  async function switchRootFolder(folderId, position) {
    if (!folderId) return false;
    if (folderId === rootFolderId) return true;

    rootFolderId = folderId;
    rootPosition = position;
    await updateActionPopup();
    await render(folderId, { pushHistory: true, resetHistory: true });
    return true;
  }

  async function invokeToolbarShortcut(position, openInNewTab) {
    const { items } = await platform.getBookmarksBarData(extensionApi.bookmarks);
    const item = items[position - 1];
    if (!item) return false;

    const itemType = platform.getNodeType(item);
    if (itemType === "folder") {
      return switchRootFolder(item.id, position);
    }

    if (itemType !== "bookmark" || typeof item.url !== "string") return false;
    await openBookmarkUrl(extensionApi.tabs, item.url, { forceNewTab: openInNewTab });
    window.close();
    return true;
  }

  async function navigateAdjacentRootFolder(direction) {
    if (fullPageView || history.length !== 1 || !rootFolderId) return false;

    const { items } = await platform.getBookmarksBarData(extensionApi.bookmarks);
    const currentIndex = items.findIndex(
      (item) => platform.getNodeType(item) === "folder" && item.id === rootFolderId
    );
    if (currentIndex < 0) return false;

    for (
      let index = currentIndex + direction;
      index >= 0 && index < items.length;
      index += direction
    ) {
      const item = items[index];
      if (platform.getNodeType(item) !== "folder") continue;
      return switchRootFolder(item.id, index + 1);
    }

    return false;
  }

  async function resolveInitialRootPosition() {
    if (!rootFolderId || rootPosition) return;
    try {
      const { items } = await platform.getBookmarksBarData(extensionApi.bookmarks);
      const index = items.findIndex((item) => item.id === rootFolderId);
      if (index >= 0) rootPosition = index + 1;
    } catch (error) {
      console.error("Failed to resolve bookmark toolbar position:", error);
    }
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

    if (popupShortcut) {
      await invokeToolbarShortcut(
        popupShortcut.position,
        popupShortcut.openInNewTab
      );
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
      await navigateAdjacentRootFolder(-1);
      return;
    }

    if (action === "right") {
      await navigateAdjacentRootFolder(1);
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

  if (initialFolderId) {
    await resolveInitialRootPosition();
    await render(initialFolderId, { pushHistory: true });
  }
}

if (
  typeof window !== "undefined" &&
  typeof document !== "undefined" &&
  extensionApi
) {
  initializeFolderView().catch((error) => {
    console.error("Failed to initialize bookmark folder view:", error);
  });
}
