"""Header parsing. New parser bugs go into cases/headers.json first."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from stillhiring import parse

CASES = json.loads((Path(__file__).parent / "cases" / "headers.json").read_text(encoding="utf-8"))
FILLER = "<p>" + "We are a small team building useful software for people who need it. " * 4


@pytest.mark.parametrize("case", CASES, ids=[case["header"][:50] for case in CASES])
def test_header(case: dict) -> None:
    body = "<p>" + case["body"] if "body" in case else ""
    post = parse.parse_post(
        {"id": 1, "author": "someone", "created_at": 0, "text": case["header"] + body + FILLER},
        "2026-11",
    )
    for field, expected in case["expect"].items():
        actual = getattr(post, field)
        if field == "header_links":
            assert set(expected) <= set(actual), f"{field}: {actual!r}"
        else:
            assert actual == expected, f"{field}: {actual!r}"


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("$120k - $150k", "$120k - $150k"),
        ("€80,000", "€80,000"),
        ("120-150k USD", "120-150k USD"),
        ("EUR 70k", "EUR 70k"),
        ("$60/hr", "$60/hr"),
        ("Salary range: £65,000 to £85,000 depending on experience", "£65,000 to £85,000"),
        ("We raised $50M Series B", None),
        ("$12M ARR and growing", None),
        ("100k users love us", None),
        ("Founded in 2019, 250 people", None),
    ],
)
def test_find_salary(text: str, expected: str | None) -> None:
    assert parse.find_salary(text) == expected


def test_roles_fall_back_to_bullets_in_the_body() -> None:
    post = parse.parse_post(
        {
            "id": 1,
            "author": "a",
            "created_at": 0,
            "text": "Yarrow | Lisbon | Full-time<p>We are hiring:<p>- Senior Backend Engineer\n"
            "- Product Designer - https://yarrow.example/jobs/2\n- Come work with us on hard problems."
            + FILLER,
        },
        "2026-11",
    )
    assert post.roles == ["Senior Backend Engineer", "Product Designer"]


def test_roles_from_a_labelled_list() -> None:
    post = parse.parse_post(
        {
            "id": 1,
            "author": "a",
            "created_at": 0,
            "text": "Zephyr | Remote<p>Open roles: Staff Engineer, Data Analyst, Recruiter"
            + FILLER,
        },
        "2026-11",
    )
    assert post.roles == ["Staff Engineer", "Data Analyst", "Recruiter"]


def test_split_header_stops_where_the_body_starts() -> None:
    glued = (
        "Alder | Remote | https://alder.example/jobs We are a company that does many things " * 3
    )
    assert parse.split_header(glued)[:2] == ["Alder", "Remote"]
    assert all(len(segment) <= parse.MAX_SEGMENT for segment in parse.split_header(glued))


def test_a_short_comment_is_not_a_job_post() -> None:
    post = parse.parse_post(
        {"id": 1, "author": "a", "created_at": 0, "text": "Birchwood"}, "2026-11"
    )
    assert post.company is None


def test_links_come_from_href_not_from_shortened_link_text() -> None:
    post = parse.parse_post(
        {
            "id": 1,
            "author": "a",
            "created_at": 0,
            "text": 'Clover | Remote<p><a href="https://clover.example/careers/senior-engineer-42">'
            "https://clover.example/careers/senior-eng...</a>" + FILLER,
        },
        "2026-11",
    )
    assert "https://clover.example/careers/senior-engineer-42" in post.links
    assert "senior-eng..." not in post.text
