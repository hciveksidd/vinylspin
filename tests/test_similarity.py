from __future__ import annotations

import json
from pathlib import Path

import pytest

from stillhiring import similarity, textutil


def words(text: str) -> list[str]:
    return textutil.tokens(text)


def test_ratio_of_identical_and_unrelated_texts() -> None:
    text = words("we build robots that sort parcels in warehouses")
    assert similarity.ratio(text, text) == 1.0
    assert similarity.ratio(text, words("zebra quilt marmalade")) == 0.0
    assert similarity.ratio(text, []) == 0.0
    assert similarity.ratio([], []) == 0.0


def test_ratio_counts_the_share_of_unchanged_words() -> None:
    before = words("one two three four five six seven eight nine ten")
    after = words("one two three four five six seven eight nine eleven")
    assert similarity.ratio(before, after) == pytest.approx(0.9)


def test_ratio_ignores_case_punctuation_and_markup_differences() -> None:
    assert (
        similarity.ratio(words("Hiring: Rust, Go & C++ devs!"), words("hiring rust go c devs"))
        == 1.0
    )


def test_group_similarity_pairs_each_post_with_its_closest_predecessor(make) -> None:
    tokens = similarity.TokenCache()
    maps = make.post("2026-01", "Acme | Maps team<p>we draw maps of every street in the world")
    pay = make.post("2026-01", "Acme | Pay team<p>we move money between banks in seconds")
    maps_again = make.post(
        "2026-02", "Acme | Maps team<p>we draw maps of every street in the world"
    )
    assert similarity.group_similarity([maps_again], [pay, maps], tokens) == 1.0


def test_group_similarity_weights_posts_by_length(make) -> None:
    tokens = similarity.TokenCache()
    old = make.post("2026-01", "alpha beta gamma delta epsilon zeta eta theta")
    same = make.post("2026-02", "alpha beta gamma delta epsilon zeta eta theta")
    new = make.post("2026-02", "omega psi")
    assert similarity.group_similarity([same, new], [old], tokens) == pytest.approx(0.8)


def test_group_similarity_without_an_earlier_post_is_unknown(make) -> None:
    post = make.post("2026-01", "Acme | Remote")
    assert similarity.group_similarity([post], [], similarity.TokenCache()) is None


CASES = json.loads(
    (Path(__file__).parent / "cases" / "similarity.json").read_text(encoding="utf-8")
)


@pytest.mark.parametrize("case", CASES, ids=[case["name"] for case in CASES])
def test_shared_cases_match_the_browser_implementation(case: dict) -> None:
    """site/diff.js is checked against the same file by tests/js/diff_test.mjs."""
    assert textutil.tokens(case["old"]) == case["old_tokens"]
    score = similarity.ratio(textutil.tokens(case["old"]), textutil.tokens(case["new"]))
    assert score == pytest.approx(case["ratio"], abs=1e-6)
