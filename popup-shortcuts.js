export function parsePopupShortcut(eventLike) {
  const {
    altKey = false,
    shiftKey = false,
    ctrlKey = false,
    metaKey = false,
    code = "",
    key = ""
  } = eventLike || {};

  if (!altKey || ctrlKey || metaKey) {
    return null;
  }

  let digit = null;
  const codeMatch = /^Digit([0-9])$/.exec(code);
  if (codeMatch) {
    digit = Number(codeMatch[1]);
  } else if (/^[0-9]$/.test(key)) {
    digit = Number(key);
  }

  if (digit === null) {
    return null;
  }

  return {
    position: digit === 0 ? 10 : digit,
    openInNewTab: shiftKey
  };
}
