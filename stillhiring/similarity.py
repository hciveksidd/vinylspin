"""How much of a post's text is unchanged from an earlier post.

The measure is difflib's ratio over words: 2 * matching words / total words,
where matches must appear in the same order. The site's diff view runs the
same algorithm in the browser, so the number on a row and the highlighted
diff agree.
"""

from __future__ import annotations

import difflib
from collections.abc import Iterable

from . import textutil

MAX_TOKENS = 1500  # posts are far shorter; this only bounds pathological input


def ratio(a: list[str], b: list[str]) -> float:
    """Similarity of two token lists, from 0.0 (nothing shared) to 1.0 (identical)."""
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    matcher = difflib.SequenceMatcher(None, a[:MAX_TOKENS], b[:MAX_TOKENS], autojunk=False)
    return matcher.ratio()


class TokenCache:
    """Tokenises each post once."""

    def __init__(self) -> None:
        self._tokens: dict[int, list[str]] = {}

    def __call__(self, post) -> list[str]:
        cached = self._tokens.get(post.id)
        if cached is None:
            cached = self._tokens[post.id] = textutil.tokens(post.text)
        return cached


def group_similarity(current: Iterable, previous: Iterable, tokens: TokenCache) -> float | None:
    """Similarity of a company's posts in one thread to its posts in an earlier one.

    A company may post several times in a thread (one post per team). Each
    current post is paired with the earlier post it resembles most, and the
    results are averaged, weighted by length.
    """
    previous = list(previous)
    total = weight = 0.0
    for post in current:
        words = tokens(post)
        if not words:
            continue
        best = max((ratio(words, tokens(other)) for other in previous), default=None)
        if best is None:
            return None
        total += best * len(words)
        weight += len(words)
    return total / weight if weight else None
