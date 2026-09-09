const ALWAYS_NEW_TAB_KEY = "always-new-tab";
const COMMAND_PATTERN = /^open-bookmark(-new)?-(10|[1-9])$/;

const platform = globalThis.BookmarkShortcutsPlatform;
const extensionApi = platform?.api;

document.body.classList.toggle("browser-chrome", Boolean(platform?.isChrome));

const checkbox = document.getElementById("always-new-tab");
const status = document.getElementById("status");
const chromeSettings = document.getElementById("chrome-settings");
const browserInfo = document.getElementById("browser-info");
const shortcutSummary = document.getElementById("shortcut-summary");
const shortcutList = document.getElementById("shortcut-list");
const bookmarkSourceSection = document.getElementById("bookmark-source-section");
const bookmarkSource = document.getElementById("bookmark-source");

checkbox.checked = localStorage.getItem(ALWAYS_NEW_TAB_KEY) === "true";

function showStatus(message) {
  status.textContent = message;
  setTimeout(() => {
    if (status.textContent === message) status.textContent = "";
  }, 1600);
}

checkbox.addEventListener("change", () => {
  localStorage.setItem(ALWAYS_NEW_TAB_KEY, String(checkbox.checked));
  showStatus("設定を保存しました。");
});

function commandLabel(name) {
  const match = COMMAND_PATTERN.exec(name ?? "");
  if (!match) return name || "Unknown command";
  const position = Number(match[2]);
  return match[1]
    ? `Bookmark ${position} · new tab`
    : `Bookmark ${position}`;
}

async function openChromeShortcutSettings() {
  try {
    const response = await extensionApi.runtime.sendMessage({
      type: "open-chrome-shortcuts"
    });
    if (response?.ok === false) {
      throw new Error(response.error || "Failed to open shortcut settings.");
    }
  } catch (error) {
    console.error("Failed to open Chrome shortcut settings:", error);
    showStatus("Chromeのショートカット設定を開けませんでした。");
  }
}

chromeSettings.addEventListener("click", (event) => {
  const link = event.target.closest?.(".chrome-shortcuts-link");
  if (!link) return;

  event.preventDefault();
  void openChromeShortcutSettings();
});

async function renderChromeShortcutStatus() {
  const commands = (await extensionApi.commands.getAll())
    .filter((command) => COMMAND_PATTERN.test(command.name ?? ""))
    .sort((a, b) => {
      const aMatch = COMMAND_PATTERN.exec(a.name);
      const bMatch = COMMAND_PATTERN.exec(b.name);
      const aNew = Boolean(aMatch?.[1]);
      const bNew = Boolean(bMatch?.[1]);
      if (aNew !== bNew) return Number(aNew) - Number(bNew);
      return Number(aMatch?.[2] ?? 0) - Number(bMatch?.[2] ?? 0);
    });

  const configured = commands.filter((command) => command.shortcut).length;
  shortcutSummary.textContent = `${configured} / ${commands.length} configured`;
  shortcutList.replaceChildren();

  for (const command of commands) {
    const item = document.createElement("li");
    item.className = command.shortcut ? "configured" : "missing";

    const link = document.createElement("a");
    link.className = "shortcut-link chrome-shortcuts-link";
    link.href = "#";
    link.setAttribute("aria-label", `${commandLabel(command.name)}: ${command.shortcut || "Not configured"}. Change shortcut`);

    const label = document.createElement("span");
    label.textContent = commandLabel(command.name);

    const shortcut = document.createElement("code");
    shortcut.textContent = command.shortcut || "Not configured";

    link.append(label, shortcut);
    item.append(link);
    shortcutList.append(item);
  }
}

function sourceLabel(candidate, itemCount) {
  const source = candidate.syncing ? "Google Account" : "This device";
  return `${source} · ${candidate.title} · ${itemCount} items`;
}

async function renderChromeBookmarkSources() {
  const candidates = await platform.getBookmarksBarCandidates(extensionApi.bookmarks);
  if (candidates.length <= 1) {
    bookmarkSourceSection.hidden = true;
    return;
  }

  const resolved = await platform.resolveBookmarksBar(extensionApi.bookmarks);
  bookmarkSource.replaceChildren();

  for (const candidate of candidates) {
    const children = await extensionApi.bookmarks.getChildren(candidate.id);
    const option = document.createElement("option");
    option.value = candidate.id;
    option.textContent = sourceLabel(candidate, children.length);
    option.selected = candidate.id === resolved.id;
    option.dataset.syncing = String(candidate.syncing);
    bookmarkSource.append(option);
  }

  bookmarkSourceSection.hidden = false;
}

bookmarkSource.addEventListener("change", async () => {
  const option = bookmarkSource.selectedOptions[0];
  if (!option) return;

  await platform.setBookmarkBarPreference({
    id: option.value,
    syncing: option.dataset.syncing === "true"
  });
  showStatus("Bookmarks Barの対象を保存しました。");
});

async function initializeChromeSettings() {
  if (!platform?.isChrome || !extensionApi) return;

  chromeSettings.hidden = false;
  const manifest = extensionApi.runtime.getManifest();
  browserInfo.textContent = `Chrome · Bookmark Shortcuts ${manifest.version}`;

  try {
    await renderChromeShortcutStatus();
  } catch (error) {
    console.error("Failed to read Chrome shortcuts:", error);
    shortcutSummary.textContent = "ショートカット設定を取得できませんでした。";
  }

  try {
    await renderChromeBookmarkSources();
  } catch (error) {
    console.error("Failed to read Chrome bookmark sources:", error);
    bookmarkSourceSection.hidden = true;
  }
}

initializeChromeSettings();
