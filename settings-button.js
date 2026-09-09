(() => {
  const platform = globalThis.BookmarkShortcutsPlatform;
  const extensionApi = platform?.api ?? globalThis.browser ?? globalThis.chrome ?? null;

  const settingsButton = document.getElementById("settings");
  const settingsBackButton = document.getElementById("settings-back");
  const upButton = document.getElementById("up");
  const rootPosition = document.getElementById("root-position");
  const title = document.getElementById("folder-title");
  const subtitle = document.getElementById("folder-subtitle");
  const folderView = document.getElementById("folder-view");
  const settingsView = document.getElementById("settings-view");
  const settingsFrame = document.getElementById("settings-frame");

  document.body.classList.toggle("browser-chrome", Boolean(platform?.isChrome));

  if (
    !settingsButton || !settingsBackButton || !folderView || !settingsView ||
    !settingsFrame || !extensionApi?.runtime
  ) {
    return;
  }

  let snapshot = null;

  function settingsActive() {
    return document.body.classList.contains("settings-view-active");
  }

  function shouldRedirectFirefoxReverseTab(event) {
    if (platform?.isChrome || settingsActive()) return false;
    if (
      event.key !== "Tab" || !event.shiftKey ||
      event.ctrlKey || event.altKey || event.metaKey ||
      settingsButton.hidden
    ) {
      return false;
    }

    const firstSelectable = document.querySelector("#items .item:not(:disabled)");
    const active = document.activeElement;
    const activeSeparator =
      active instanceof Element && active.matches("#items hr");

    return (
      active === firstSelectable ||
      active === document.body ||
      active === document.documentElement ||
      activeSeparator
    );
  }

  function showSettings() {
    if (settingsActive()) return;

    snapshot = {
      upHidden: upButton?.hidden ?? true,
      rootHidden: rootPosition?.hidden ?? true,
      title: title?.textContent ?? "Bookmark Shortcuts",
      subtitle: subtitle?.textContent ?? ""
    };

    document.body.classList.remove("keyboard-navigation");
    document.body.classList.add("settings-view-active");

    if (upButton) upButton.hidden = true;
    if (rootPosition) rootPosition.hidden = true;
    settingsButton.hidden = true;
    settingsBackButton.hidden = false;

    if (title) title.textContent = "Settings";
    if (subtitle) {
      subtitle.textContent = `Bookmark Shortcuts · ${platform?.isChrome ? "Chrome" : "Firefox"}`;
    }

    folderView.hidden = true;
    settingsView.hidden = false;

    if (!settingsFrame.getAttribute("src")) {
      settingsFrame.src = extensionApi.runtime.getURL("options.html?embedded=1");
    }

    settingsBackButton.focus({ preventScroll: true });
  }

  function hideSettings() {
    if (!settingsActive()) return;

    document.body.classList.remove("settings-view-active");
    folderView.hidden = false;
    settingsView.hidden = true;
    settingsButton.hidden = false;
    settingsBackButton.hidden = true;

    if (upButton) upButton.hidden = snapshot?.upHidden ?? true;
    if (rootPosition) rootPosition.hidden = snapshot?.rootHidden ?? true;
    if (title) title.textContent = snapshot?.title ?? "Bookmark Shortcuts";
    if (subtitle) subtitle.textContent = snapshot?.subtitle ?? "";

    snapshot = null;
    settingsButton.focus({ preventScroll: true });
  }

  settingsButton.addEventListener("click", showSettings);
  settingsBackButton.addEventListener("click", hideSettings);

  window.addEventListener("keydown", (event) => {
    if (shouldRedirectFirefoxReverseTab(event)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      settingsButton.focus({ preventScroll: true });
      return;
    }

    if (settingsActive()) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        hideSettings();
        return;
      }

      if (
        event.target === settingsBackButton &&
        (event.key === "Enter" || event.key === " ")
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        hideSettings();
        return;
      }

      if (event.target === settingsBackButton && event.key !== "Tab") {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      return;
    }

    if (
      event.target === settingsButton &&
      (event.key === "Enter" || event.key === " ")
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showSettings();
    }
  }, true);

  document.addEventListener("focusin", (event) => {
    if (platform?.isChrome || settingsActive() || settingsButton.hidden) return;
    if (!(event.target instanceof Element) || !event.target.matches("#items hr")) return;
    settingsButton.focus({ preventScroll: true });
  });

  window.addEventListener("message", (event) => {
    if (!settingsActive()) return;
    if (event.source !== settingsFrame.contentWindow) return;
    if (event.data?.type !== "close-popup-settings") return;
    hideSettings();
  });
})();
