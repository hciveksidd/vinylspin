// Run with: node --test tests/js/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { diffWords, matchingBlocks, ratio, similarity, tokenize } from "../../site/diff.js";

const cases = JSON.parse(readFileSync(new URL("../cases/similarity.json", import.meta.url), "utf8"));
const words = (text) => tokenize(text).map((token) => token.word);

for (const item of cases) {
  test(`same result as the pipeline: ${item.name}`, () => {
    assert.deepEqual(words(item.old), item.old_tokens);
    assert.ok(Math.abs(similarity(item.old, item.new) - item.ratio) < 1e-6);
  });
}

test("tokenize keeps a link whole and records where each word starts", () => {
  const tokens = tokenize("Apply: https://Acme.example/jobs?id=1. Now!");
  assert.deepEqual(tokens, [
    { word: "apply", start: 0 },
    { word: "https://acme.example/jobs?id=1", start: 7 },
    { word: "now", start: 39 },
  ]);
});

test("matchingBlocks finds shared runs in order", () => {
  assert.deepEqual(matchingBlocks(words("a b c d e"), words("x b c y e")), [
    [1, 1, 2],
    [4, 4, 1],
  ]);
});

test("ratio of empty input is zero", () => {
  assert.equal(ratio([], []), 0);
  assert.equal(ratio(["a"], []), 0);
});

test("diffWords marks removed and added words and keeps punctuation", () => {
  const result = diffWords(
    "We build robots. The team is forty people!",
    "We build robots. The team is sixty people!",
  );
  assert.deepEqual(result.parts, [
    { type: "same", text: "We build robots. The team is " },
    { type: "del", text: "forty " },
    { type: "ins", text: "sixty " },
    { type: "same", text: "people!" },
  ]);
  assert.equal(result.same, 7);
  assert.equal(result.total, 16);
  assert.equal(result.ratio, 0.875);
});

test("diffWords of identical texts is one unchanged part", () => {
  const text = "- Senior Engineer (Rust)\n- Designer";
  const result = diffWords(text, text);
  assert.deepEqual(result.parts, [{ type: "same", text }]);
  assert.equal(result.ratio, 1);
});

test("diffWords handles text added at the start and removed at the end", () => {
  const result = diffWords("alpha beta gamma", "new alpha beta");
  assert.deepEqual(
    result.parts.map((part) => [part.type, part.text.trim()]),
    [
      ["ins", "new"],
      ["same", "alpha beta"],
      ["del", "gamma"],
    ],
  );
});

test("diffWords copes with an empty side", () => {
  assert.deepEqual(diffWords("", "all new").parts, [{ type: "ins", text: "all new" }]);
  assert.deepEqual(diffWords("all gone", "").parts, [{ type: "del", text: "all gone" }]);
  assert.equal(diffWords("", "").ratio, 0);
});

test("joining the parts without deletions gives back the new text", () => {
  for (const item of cases) {
    const rebuilt = diffWords(item.old, item.new)
      .parts.filter((part) => part.type !== "del")
      .map((part) => part.text)
      .join("");
    assert.equal(rebuilt, item.new);
  }
});
