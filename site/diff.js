// Word-level comparison of two posts.
//
// This is the same algorithm the pipeline uses (Python's difflib.SequenceMatcher
// without junk heuristics, see stillhiring/similarity.py), so the percentage
// shown next to a diff equals the one in the published data.

const TOKEN_RE = /https?:\/\/\S+|[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;
const URL_TAIL_RE = /[.,;:!?)}>'"*|]+$/;
export const MAX_TOKENS = 1500;

/** Lower-cased words with their position in the text. A URL is one word. */
export function tokenize(text) {
  const tokens = [];
  for (const match of text.toLowerCase().matchAll(TOKEN_RE)) {
    let word = match[0];
    if (word.startsWith("http")) word = word.replace(URL_TAIL_RE, "");
    tokens.push({ word, start: match.index });
  }
  return tokens;
}

function longestMatch(a, b, positions, alo, ahi, blo, bhi) {
  let bestA = alo;
  let bestB = blo;
  let bestSize = 0;
  let lengths = new Map();
  for (let i = alo; i < ahi; i++) {
    const next = new Map();
    for (const j of positions.get(a[i]) ?? []) {
      if (j < blo) continue;
      if (j >= bhi) break;
      const size = (lengths.get(j - 1) ?? 0) + 1;
      next.set(j, size);
      if (size > bestSize) {
        bestA = i - size + 1;
        bestB = j - size + 1;
        bestSize = size;
      }
    }
    lengths = next;
  }
  return [bestA, bestB, bestSize];
}

/** Runs of words shared by a and b, in order: [[indexInA, indexInB, length], ...]. */
export function matchingBlocks(a, b) {
  const positions = new Map();
  b.forEach((word, j) => {
    if (!positions.has(word)) positions.set(word, []);
    positions.get(word).push(j);
  });
  const blocks = [];
  const queue = [[0, a.length, 0, b.length]];
  while (queue.length) {
    const [alo, ahi, blo, bhi] = queue.pop();
    const [i, j, size] = longestMatch(a, b, positions, alo, ahi, blo, bhi);
    if (!size) continue;
    blocks.push([i, j, size]);
    if (alo < i && blo < j) queue.push([alo, i, blo, j]);
    if (i + size < ahi && j + size < bhi) queue.push([i + size, ahi, j + size, bhi]);
  }
  return blocks.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
}

/** Similarity of two word lists: 0 = nothing shared, 1 = identical. */
export function ratio(a, b) {
  if (!a.length || !b.length) return 0;
  a = a.slice(0, MAX_TOKENS);
  b = b.slice(0, MAX_TOKENS);
  const matched = matchingBlocks(a, b).reduce((sum, block) => sum + block[2], 0);
  return (2 * matched) / (a.length + b.length);
}

export function similarity(oldText, newText) {
  return ratio(
    tokenize(oldText).map((token) => token.word),
    tokenize(newText).map((token) => token.word),
  );
}

function slice(text, tokens, from, to) {
  if (from >= to) return "";
  const end = to < tokens.length ? tokens[to].start : text.length;
  return text.slice(tokens[from].start, end);
}

/**
 * Compare two texts word by word.
 *
 * Returns {parts, ratio, same, total}. `parts` reads as the new text with the
 * removed words of the old one spliced in: [{type: "same" | "del" | "ins", text}].
 */
export function diffWords(oldText, newText) {
  const oldTokens = tokenize(oldText).slice(0, MAX_TOKENS);
  const newTokens = tokenize(newText).slice(0, MAX_TOKENS);
  const a = oldTokens.map((token) => token.word);
  const b = newTokens.map((token) => token.word);
  const parts = [];
  const push = (type, text) => {
    if (!text) return;
    const last = parts[parts.length - 1];
    if (last && last.type === type) last.text += text;
    else parts.push({ type, text });
  };

  // Text before the first word (a bullet, an opening bracket) belongs to nobody.
  push("same", newTokens.length ? newText.slice(0, newTokens[0].start) : newText);
  let i = 0;
  let j = 0;
  let same = 0;
  for (const [ai, bj, size] of [...matchingBlocks(a, b), [a.length, b.length, 0]]) {
    push("del", slice(oldText, oldTokens, i, ai));
    push("ins", slice(newText, newTokens, j, bj));
    push("same", slice(newText, newTokens, bj, bj + size));
    same += size;
    i = ai + size;
    j = bj + size;
  }
  const total = a.length + b.length;
  return { parts, same, total, ratio: total ? (2 * same) / total : 0 };
}
