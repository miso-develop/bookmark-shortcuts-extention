import assert from "node:assert/strict";
import test from "node:test";

import { parsePopupShortcut } from "../popup-shortcuts.js";

test("parses Alt+1 through Alt+0 in the folder popup", () => {
  assert.deepEqual(
    parsePopupShortcut({ altKey: true, code: "Digit1", key: "1" }),
    { position: 1, openInNewTab: false }
  );
  assert.deepEqual(
    parsePopupShortcut({ altKey: true, code: "Digit9", key: "9" }),
    { position: 9, openInNewTab: false }
  );
  assert.deepEqual(
    parsePopupShortcut({ altKey: true, code: "Digit0", key: "0" }),
    { position: 10, openInNewTab: false }
  );
});

test("uses event.code so Alt+Shift+number works on layouts where key becomes a symbol", () => {
  assert.deepEqual(
    parsePopupShortcut({
      altKey: true,
      shiftKey: true,
      code: "Digit1",
      key: "!"
    }),
    { position: 1, openInNewTab: true }
  );
});

test("falls back to event.key when event.code is unavailable", () => {
  assert.deepEqual(
    parsePopupShortcut({ altKey: true, key: "4" }),
    { position: 4, openInNewTab: false }
  );
});

test("ignores unrelated or modified key combinations", () => {
  assert.equal(parsePopupShortcut({ code: "Digit1", key: "1" }), null);
  assert.equal(
    parsePopupShortcut({ altKey: true, ctrlKey: true, code: "Digit1", key: "1" }),
    null
  );
  assert.equal(
    parsePopupShortcut({ altKey: true, metaKey: true, code: "Digit1", key: "1" }),
    null
  );
  assert.equal(parsePopupShortcut({ altKey: true, code: "KeyA", key: "a" }), null);
});
