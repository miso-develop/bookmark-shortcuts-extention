export const TYPEAHEAD_RESET_MS = 1000;

export function normalizeTypeaheadText(value) {
  return String(value ?? "").normalize("NFKC").toLocaleLowerCase();
}

export function isTypeaheadKeyEvent(eventLike = {}) {
  const key = typeof eventLike.key === "string" ? eventLike.key : "";
  return (
    !eventLike.ctrlKey &&
    !eventLike.altKey &&
    !eventLike.metaKey &&
    !eventLike.isComposing &&
    Array.from(key).length === 1
  );
}

export function findTypeaheadMatchIndex(
  labels,
  query,
  { startIndex = 0 } = {}
) {
  if (!Array.isArray(labels) || labels.length === 0) return -1;

  const normalizedQuery = normalizeTypeaheadText(query);
  if (!normalizedQuery) return -1;

  const itemCount = labels.length;
  const rawStart = Number.isInteger(startIndex) ? startIndex : 0;
  const normalizedStart = ((rawStart % itemCount) + itemCount) % itemCount;

  for (let offset = 0; offset < itemCount; offset += 1) {
    const index = (normalizedStart + offset) % itemCount;
    const label = normalizeTypeaheadText(labels[index]).trimStart();
    if (label.startsWith(normalizedQuery)) return index;
  }

  return -1;
}

function initializeFolderTypeahead() {
  let query = "";
  let resetTimer = null;

  function resetTypeahead() {
    query = "";
    if (resetTimer !== null) {
      clearTimeout(resetTimer);
      resetTimer = null;
    }
  }

  function scheduleReset() {
    if (resetTimer !== null) clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      query = "";
      resetTimer = null;
    }, TYPEAHEAD_RESET_MS);
  }

  function selectableItems() {
    return Array.from(document.querySelectorAll("#items .item:not(:disabled)"));
  }

  function itemLabel(item) {
    return item.querySelector(".item-label")?.textContent ?? "";
  }

  function focusMatch(items, index) {
    const item = items[index];
    if (!item) return false;

    document.body.classList.add("keyboard-navigation");
    item.focus({ preventScroll: true });
    item.scrollIntoView({ block: "nearest" });
    return true;
  }

  window.addEventListener("keydown", (event) => {
    if (
      document.body.classList.contains("settings-view-active") ||
      document.body.classList.contains("full-page")
    ) {
      resetTypeahead();
      return;
    }

    if (!isTypeaheadKeyEvent(event)) {
      resetTypeahead();
      return;
    }

    const items = selectableItems();
    if (items.length === 0) {
      resetTypeahead();
      return;
    }

    const normalizedKey = normalizeTypeaheadText(event.key);
    if (!normalizedKey) {
      resetTypeahead();
      return;
    }

    const cycleSameInitial = query.length === 1 && query === normalizedKey;
    const nextQuery = cycleSameInitial ? normalizedKey : `${query}${normalizedKey}`;
    const currentIndex = items.indexOf(document.activeElement);
    const startIndex = cycleSameInitial && currentIndex >= 0 ? currentIndex + 1 : 0;
    const matchIndex = findTypeaheadMatchIndex(
      items.map(itemLabel),
      nextQuery,
      { startIndex }
    );

    query = nextQuery;
    scheduleReset();

    event.preventDefault();
    event.stopImmediatePropagation();

    if (matchIndex >= 0) {
      focusMatch(items, matchIndex);
    }
  }, true);

  document.addEventListener("pointerdown", resetTypeahead, true);
  window.addEventListener("blur", resetTypeahead);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  initializeFolderTypeahead();
}
