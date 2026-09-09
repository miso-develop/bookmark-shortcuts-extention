(() => {
  const platform = globalThis.BookmarkShortcutsPlatform;
  const extensionApi = platform?.api ?? globalThis.browser ?? globalThis.chrome ?? null;
  const settingsButton = document.getElementById("settings");

  document.body.classList.toggle("browser-chrome", Boolean(platform?.isChrome));

  if (!settingsButton || !extensionApi?.runtime) return;

  let opening = false;

  async function openSettings() {
    if (opening) return;
    opening = true;

    try {
      if (platform?.isChrome) {
        const response = await extensionApi.runtime.sendMessage({
          type: "open-options-page"
        });
        if (response?.ok === false) {
          throw new Error(response.error || "Failed to open extension settings.");
        }
      } else {
        const optionsUrl = extensionApi.runtime.getURL("options.html");
        if (typeof extensionApi.tabs?.create === "function") {
          await extensionApi.tabs.create({ url: optionsUrl });
        } else {
          window.open(optionsUrl, "_blank", "noopener");
        }
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
