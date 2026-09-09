(() => {
  const platform = globalThis.BookmarkShortcutsPlatform;
  const extensionApi = platform?.api ?? globalThis.browser ?? globalThis.chrome ?? null;
  const settingsButton = document.getElementById("settings");

  document.body.classList.toggle("browser-chrome", Boolean(platform?.isChrome));

  if (!settingsButton || !extensionApi?.runtime?.sendMessage) return;

  let opening = false;

  async function openSettings() {
    if (opening) return;
    opening = true;

    try {
      const response = await extensionApi.runtime.sendMessage({
        type: "open-options-page"
      });
      if (response?.ok === false) {
        throw new Error(response.error || "Failed to open extension settings.");
      }
      window.close();
    } catch (error) {
      opening = false;
      console.error("Failed to open extension settings:", error);
    }
  }

  settingsButton.addEventListener("click", () => {
    void openSettings();
  });

  window.addEventListener("keydown", (event) => {
    if (event.target !== settingsButton) return;
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    event.stopImmediatePropagation();
    void openSettings();
  }, true);
})();
