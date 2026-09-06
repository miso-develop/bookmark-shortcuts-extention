const ALWAYS_NEW_TAB_KEY = "always-new-tab";

const checkbox = document.getElementById("always-new-tab");
const status = document.getElementById("status");

checkbox.checked = localStorage.getItem(ALWAYS_NEW_TAB_KEY) === "true";

checkbox.addEventListener("change", () => {
  localStorage.setItem(ALWAYS_NEW_TAB_KEY, String(checkbox.checked));
  status.textContent = "設定を保存しました。";
  setTimeout(() => {
    status.textContent = "";
  }, 1200);
});
