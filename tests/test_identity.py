"""Which posts count as one company. Every name and domain here is invented."""

from __future__ import annotations

import json

import pytest

from stillhiring import identity

MONTHS = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"]


def group(make, specs: list[tuple[str, str]], overrides: identity.Overrides | None = None):
    """Cluster posts given as (header and body, author), one per month."""
    posts = [
        make.post(MONTHS[index % len(MONTHS)], text, author)
        for index, (text, author) in enumerate(specs)
    ]
    posts.sort(key=lambda post: (post.month, post.id))
    return identity.cluster(posts, overrides)


def names(result: identity.Clustering) -> list[list[str]]:
    """Spellings per company, as sorted lists, for easy comparison."""
    return sorted(sorted({post.company or "" for post in c.posts}) for c in result.companies)


@pytest.mark.parametrize(
    ("name", "expected"),
    [
        ("The Acme Co., Inc.", "acme"),
        ("ACME", "acme"),
        ("Zorvex.io", "zorvex"),
        ("Aha!", "aha"),
        ("Café Zoë GmbH", "cafezoe"),
        ("AT&T", "atandt"),
        ("Stealth", None),
        ("Stealth Startup", None),
        (None, None),
    ],
)
def test_name_key(name: str | None, expected: str | None) -> None:
    assert identity.name_key(name) == expected


def test_spellings_of_one_name_merge(make) -> None:
    result = group(
        make, [("Acme | Remote", "a"), ("ACME, Inc. | Remote", "b"), ("The Acme | Berlin", "c")]
    )
    assert len(result.companies) == 1
    assert len(result.companies[0].posts) == 3


def test_an_ats_board_merges_a_renamed_company(make) -> None:
    result = group(
        make,
        [
            ("Maple Systems | Remote<p>https://jobs.lever.co/larch/1", "a"),
            ("Larch | Remote<p>https://jobs.lever.co/larch/2", "b"),
            ("Larch | Remote<p>https://jobs.lever.co/larch/3", "b"),
        ],
    )
    assert names(result) == [["Larch", "Maple Systems"]]
    assert result.companies[0].name == "Larch"


def test_a_portfolio_board_does_not_merge_the_companies_on_it(make) -> None:
    startups = ["Conduit", "Flaxseed", "Budgie", "Katona"]
    result = group(
        make,
        [
            (f"{name} | Remote<p>https://jobs.ashbyhq.com/pearfund/{name}", name)
            for name in startups
        ],
    )
    assert names(result) == [[name] for name in sorted(startups)]
    assert result.shared_keys == {"ats:ashby:pearfund": 4}


def test_a_job_board_named_after_nobody_merges_nothing(make) -> None:
    result = group(
        make,
        [
            ("Spacelane | Remote | https://jobsite.example/jobs/1", "a"),
            ("Tidalwave | Remote | https://jobsite.example/jobs/2", "b"),
        ],
    )
    assert names(result) == [["Spacelane"], ["Tidalwave"]]
    assert "dom:jobsite.example" in result.shared_keys


def test_a_recruiter_keeps_clients_apart(make) -> None:
    mail = "<p>Write to people@talentwell.example"
    result = group(
        make,
        [
            ("Talentwell Recruiting | Remote" + mail, "recruiter"),
            ("Graphite | Palo Alto" + mail, "recruiter"),
            ("Velodyne Print | San Jose" + mail, "recruiter"),
            ("Graphite | Palo Alto" + mail, "recruiter"),
        ],
    )
    assert names(result) == [["Graphite"], ["Talentwell Recruiting"], ["Velodyne Print"]]


def test_an_abbreviated_domain_ties_two_names_together(make) -> None:
    link = "<p>https://allenai.example/careers"
    result = group(
        make,
        [("Ai2 | Seattle" + link, "a"), ("Allen Institute for AI | Seattle" + link, "b")],
    )
    assert len(result.companies) == 1
    assert result.companies[0].domains == ["allenai.example"]


CRYPTO = "<p>We run a crypto exchange with deep liquidity and round the clock trading desks."
IMAGES = "<p>Our API shrinks photographs for web pages without visible loss of quality."


def test_same_name_with_different_domains_stays_apart(make) -> None:
    result = group(
        make,
        [
            ("Zorvex | Remote | https://zorvex.example" + CRYPTO, "exchange_hr"),
            ("Zorvex | Remote | https://zorvex.example" + CRYPTO, "exchange_hr"),
            ("Zorvex.io | Remote" + IMAGES, "image_dev"),
        ],
    )
    assert len(result.companies) == 2
    assert sorted(c.id for c in result.companies) == ["zorvex", "zorvex-io"]
    assert [conflict["name"] for conflict in result.conflicts] == ["zorvex"]


def test_same_name_with_different_domains_merges_for_one_author(make) -> None:
    result = group(
        make,
        [
            ("Zorvex | Remote | https://zorvex.example" + CRYPTO, "same_person"),
            ("Zorvex | Remote | https://zorvex.io" + IMAGES, "same_person"),
        ],
    )
    assert len(result.companies) == 1 and not result.conflicts


def test_same_name_with_different_domains_merges_for_similar_text(make) -> None:
    result = group(
        make,
        [
            ("Zorvex | Remote | https://zorvex.example" + CRYPTO, "one"),
            ("Zorvex | Remote | https://zorvex.io" + CRYPTO, "two"),
        ],
    )
    assert len(result.companies) == 1


def test_a_post_without_links_joins_the_only_company_of_that_name(make) -> None:
    result = group(
        make,
        [
            ("Zorvex | Remote | https://zorvex.example" + CRYPTO, "a"),
            ("Zorvex | Onsite" + IMAGES, "b"),
        ],
    )
    assert len(result.companies) == 1


def test_a_post_without_links_does_not_pick_between_two_companies(make) -> None:
    result = group(
        make,
        [
            ("Zorvex | Remote | https://zorvex.example" + CRYPTO, "a"),
            ("Zorvex.io | Remote" + IMAGES, "b"),
            (
                "Zorvex | Lisbon<p>We sell diving equipment to schools and clubs across the coast.",
                "c",
            ),
        ],
    )
    assert len(result.companies) == 3


def test_a_post_without_a_name_joins_by_its_own_link(make) -> None:
    result = group(
        make,
        [
            ("Acme | Remote | https://acme.example", "a"),
            ("https://acme.example | Engineers | Remote", "b"),
        ],
    )
    assert len(result.companies) == 1 and not result.unmatched


def test_a_post_without_name_or_link_joins_by_author(make) -> None:
    result = group(
        make,
        [
            ("Acme | Remote | https://acme.example", "acme_hr"),
            ("we are still looking for people, see my earlier post for the details", "acme_hr"),
            ("we are still looking for people, see my earlier post for the details", "stranger"),
        ],
    )
    assert [len(c.posts) for c in result.companies] == [2]
    assert [post.author for post in result.unmatched] == ["stranger"]


def test_an_author_who_posted_for_two_companies_is_not_used(make) -> None:
    result = group(
        make,
        [
            ("Acme | Remote", "agency"),
            ("Bolt | Remote", "agency"),
            ("we are still looking for people, see my earlier post for the details", "agency"),
        ],
    )
    assert len(result.unmatched) == 1


def test_overrides_merge_rename_and_ignore(make, tmp_path) -> None:
    path = tmp_path / "overrides.json"
    path.write_text(
        json.dumps(
            {
                "merge": [["Blockwise", "Squarely"]],
                "rename": {"Squarely": "Blockwise (formerly Squarely)"},
                "ignore_keys": ["ats:lever:sharedboard"],
            }
        )
    )
    overrides = identity.Overrides.load(path)
    result = group(
        make,
        [
            ("Squarely | Remote", "a"),
            ("Blockwise | Remote", "b"),
            ("Dune | Remote<p>https://jobs.lever.co/sharedboard/1", "c"),
            ("https://jobs.lever.co/sharedboard/2 | Engineers | Remote", "d"),
        ],
        overrides,
    )
    merged = next(c for c in result.companies if len(c.posts) == 2)
    assert merged.name == "Blockwise (formerly Squarely)"
    assert "ats:lever:sharedboard" in result.shared_keys
    assert len(result.unmatched) == 1


def test_overrides_separate_blocks_a_name_merge(make) -> None:
    specs = [
        ("Zorvex | Remote | https://zorvex.example" + CRYPTO, "a"),
        ("Zorvex | Onsite" + IMAGES, "b"),
    ]
    assert len(group(make, specs).companies) == 1
    apart = identity.Overrides(separate=[["dom:zorvex.example", "name:zorvex"]])
    # The second post holds only the name, the first holds both keys: they differ.
    assert len(group(make, specs, apart).companies) == 2


def test_missing_overrides_file_means_no_overrides(tmp_path) -> None:
    assert identity.Overrides.load(tmp_path / "nope.json") == identity.Overrides()
    assert identity.Overrides.load(None) == identity.Overrides()


def test_display_name_is_the_spelling_used_most_recently_and_often(make) -> None:
    link = "<p>https://jobs.lever.co/betterstack/1"
    specs = [("Better Uptime | Remote" + link, "a")] * 2 + [
        ("Better Stack | Remote" + link, "a")
    ] * 2
    result = group(make, specs)
    assert result.companies[0].name == "Better Stack"
    assert result.companies[0].names == [("Better Uptime", 2), ("Better Stack", 2)]


def test_ids_are_unique_and_do_not_depend_on_input_order(make) -> None:
    specs = [
        ("Zorvex | Remote | https://zorvex.example" + CRYPTO, "a"),
        ("Zorvex | Remote | https://zorvex.example" + CRYPTO, "a"),
        ("Zorvex | Remote | https://zorvex.io" + IMAGES, "b"),
        ("Acme | Remote", "c"),
    ]
    first = sorted(c.id for c in group(make, specs).companies)
    second = sorted(c.id for c in group(make, list(reversed(specs))).companies)
    # Two companies spell their name the same way: the smaller one gets its domain appended.
    assert first == second == ["acme", "zorvex", "zorvex-zorvex-io"]
