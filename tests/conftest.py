"""Shared helpers. All companies and post texts in the tests are invented."""

from __future__ import annotations

import sys
from datetime import UTC, datetime
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from stillhiring import hn, parse  # noqa: E402

DAY = 86400


def month_start(month: str) -> int:
    """Unix time of the 2nd of the month, when the thread goes up."""
    return int(datetime(int(month[:4]), int(month[5:7]), 2, 15, tzinfo=UTC).timestamp())


# The newest sample thread (2026-11) is 18 days old here, so it counts as closed.
NOW = int(datetime(2026, 11, 20, 12, tzinfo=UTC).timestamp())


class PostFactory:
    """Builds parsed posts and raw threads with unique ids."""

    def __init__(self) -> None:
        self.next_id = 1000

    def raw(self, text: str, author: str = "poster") -> dict:
        self.next_id += 1
        return {"id": self.next_id, "author": author, "created_at": 0, "text": text}

    def post(self, month: str, text: str, author: str = "poster") -> parse.Post:
        return parse.parse_post(self.raw(text, author), month)

    def thread(self, month: str, posts: list[dict], fetched_at: int | None = None) -> dict:
        created = month_start(month)
        return {
            "month": month,
            "id": int(month.replace("-", "")),
            "title": f"Ask HN: Who is hiring? ({month})",
            "created_at": created,
            "fetched_at": created + 60 * DAY if fetched_at is None else fetched_at,
            "num_comments": len(posts),
            "posts": posts,
        }


@pytest.fixture
def make() -> PostFactory:
    return PostFactory()


ACME = (
    "Acme Robotics | Senior Backend Engineer, Staff SRE | Berlin, Germany | ONSITE | €90k-€120k"
    "<p>We build warehouse robots that sort parcels. The team is forty people and growing."
    '<p>Apply: <a href="https://jobs.lever.co/acmerobotics/123">https://jobs.lever.co/acmer...</a>'
)
ACME_EDITED = (
    "Acme Robotics | Data Engineer | Berlin, Germany | ONSITE | €95k-€125k"
    "<p>Our drones now count inventory at night, and we need help with the data they produce."
    '<p>Apply: <a href="https://jobs.lever.co/acmerobotics/456">https://jobs.lever.co/acmer...</a>'
)
BOLT = (
    "Bolt Bakery (YC W21) | Founding Engineer | REMOTE (US) | Full-time | $150k-$180k + equity"
    "<p>Software for neighbourhood bakeries: ordering, routing and payroll in one place."
    '<p><a href="https://boltbakery.example/careers">https://boltbakery.example/careers</a>'
)
CEDAR = (
    "Cedar Analytics | Data Scientist | London, UK | Hybrid"
    "<p>We measure how forests grow from satellite images. Small research-minded team."
    "<p>Write to jobs@cedaranalytics.example"
)
FILLER = "<p>" + "We are a small team building useful software for people who need it. " * 4


@pytest.fixture
def raw_dir(tmp_path: Path, make: PostFactory) -> Path:
    """Six monthly threads, 2026-06 to 2026-11.

    Acme posts every month and rewrites its post once, in 2026-09.
    Bolt posts in 06-09 and then stops. Cedar appears only in 2026-11.
    One top-level comment in 2026-11 is not a job post.
    """
    directory = tmp_path / "raw"
    plan = {
        "2026-06": [(ACME, "acme_hr"), (BOLT, "bolt_founder")],
        "2026-07": [(ACME, "acme_hr"), (BOLT, "bolt_founder")],
        "2026-08": [(ACME, "acme_hr"), (BOLT, "bolt_founder")],
        "2026-09": [(ACME_EDITED, "acme_hr"), (BOLT, "bolt_founder")],
        "2026-10": [(ACME_EDITED, "acme_hr")],
        "2026-11": [
            (ACME_EDITED, "acme_hr"),
            (CEDAR, "cedar_cto"),
            ("Thanks for the thread!", "x"),
        ],
    }
    for month, posts in plan.items():
        thread = make.thread(month, [make.raw(text, author) for text, author in posts])
        hn.save_raw(hn.raw_path(directory, month), thread)
    return directory
