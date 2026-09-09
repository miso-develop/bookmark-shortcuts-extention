import assert from "node:assert/strict";
import test from "node:test";

import { resolveTypeaheadInput } from "../typeahead.js";

const labels = ["Amazon", "GitHub", "Google Drive", "GitLab"];

test("keeps a valid multi-character type-ahead query", () => {
  assert.deepEqual(
    resolveTypeaheadInput(labels, "g", "i", { currentIndex: 2 }),
    { query: "gi", matchIndex: 1 }
  );
});

test("falls back to a fresh single-character query when the buffered query has no match", () => {
  assert.deepEqual(
    resolveTypeaheadInput(labels, "g", "a", { currentIndex: 2 }),
    { query: "a", matchIndex: 0 }
  );
});

test("can focus an item above the current item after a prior type-ahead focus", () => {
  const first = resolveTypeaheadInput(labels, "", "g", { currentIndex: 0 });
  assert.equal(first.matchIndex, 1);

  const second = resolveTypeaheadInput(labels, first.query, "a", {
    currentIndex: first.matchIndex
  });
  assert.deepEqual(second, { query: "a", matchIndex: 0 });
});

test("still cycles repeated single-character matches", () => {
  assert.deepEqual(
    resolveTypeaheadInput(labels, "g", "g", { currentIndex: 1 }),
    { query: "g", matchIndex: 2 }
  );
});
