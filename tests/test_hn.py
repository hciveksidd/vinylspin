from __future__ import annotations

import io
import json
import urllib.error
from pathlib import Path

import pytest
from conftest import DAY, month_start

from stillhiring import hn


class FakeAPI:
    """Stands in for urlopen: serves canned JSON by URL substring, records calls."""

    def __init__(self, routes: dict[str, object]) -> None:
        self.routes = routes
        self.calls: list[str] = []
        self.user_agents: list[str] = []

    def __call__(self, request, timeout=None):
        self.calls.append(request.full_url)
        self.user_agents.append(request.get_header("User-agent"))
        for fragment, payload in self.routes.items():
            if fragment in request.full_url:
                if isinstance(payload, list):
                    payload = payload.pop(0) if len(payload) > 1 else payload[0]
                if isinstance(payload, Exception):
                    raise payload
                return io.BytesIO(json.dumps(payload).encode())
        raise AssertionError(f"unexpected request {request.full_url}")


def hit(title: str, object_id: int, comments: int = 10, created: int = 0) -> dict:
    return {
        "title": title,
        "objectID": str(object_id),
        "num_comments": comments,
        "created_at_i": created,
    }


def item(*children: dict) -> dict:
    return {"id": 1, "children": list(children)}


def comment(comment_id: int, text: str | None = "Acme | Remote", author: str | None = "a") -> dict:
    return {
        "id": comment_id,
        "text": text,
        "author": author,
        "created_at_i": 5,
        "children": [{"id": 99}],
    }


def client(api: FakeAPI, sleeps: list[float] | None = None) -> hn.Client:
    sleeps = [] if sleeps is None else sleeps
    return hn.Client(opener=api, sleep=sleeps.append, delay=0, user_agent="test-agent")


@pytest.mark.parametrize(
    ("title", "expected"),
    [
        ("Ask HN: Who is hiring? (June 2021)", "2021-06"),
        ("Ask HN: Who Is Hiring? (November 2012) ", "2012-11"),
        ("Ask HN: Who is hiring right now?", None),
        ("Ask HN: Who wants to be hired? (June 2021)", None),
        ("Ask HN: Freelancer? Seeking freelancer? (June 2021)", None),
    ],
)
def test_month_from_title(title: str, expected: str | None) -> None:
    assert hn.month_from_title(title) == expected


def test_list_threads_filters_sorts_and_keeps_one_thread_per_month() -> None:
    api = FakeAPI(
        {
            "search_by_date": {
                "nbPages": 1,
                "hits": [
                    hit("Ask HN: Who is hiring? (March 2019)", 3),
                    hit("Ask HN: Who wants to be hired? (March 2019)", 4),
                    hit("Ask HN: Who is hiring? (January 2019)", 1, comments=5),
                    hit("Ask HN: Who is hiring? (January 2019)", 2, comments=500),
                    hit("Ask HN: Who is hiring? (December 2018)", 9),
                ],
            }
        }
    )
    threads = client(api).list_threads("2019-01")
    assert [(thread.month, thread.id) for thread in threads] == [("2019-01", 2), ("2019-03", 3)]
    assert api.user_agents == ["test-agent"]
    assert "tags=story,author_whoishiring" in api.calls[0]


def test_list_threads_reads_every_page() -> None:
    pages = [
        {"nbPages": 2, "hits": [hit("Ask HN: Who is hiring? (May 2020)", 5)]},
        {"nbPages": 2, "hits": [hit("Ask HN: Who is hiring? (April 2020)", 4)]},
    ]
    api = FakeAPI({"search_by_date": pages})
    assert [thread.month for thread in client(api).list_threads("2019-01")] == [
        "2020-04",
        "2020-05",
    ]
    assert len(api.calls) == 2


def test_fetch_thread_keeps_top_level_posts_and_drops_deleted_ones() -> None:
    api = FakeAPI({"items/7": item(comment(12), comment(11), comment(13, text=None, author=None))})
    ref = hn.ThreadRef("2026-11", 7, "Ask HN: Who is hiring? (November 2026)", 100, 3)
    thread = client(api).fetch_thread(ref, now=500)
    assert [post["id"] for post in thread["posts"]] == [11, 12]
    assert set(thread["posts"][0]) == {"id", "author", "created_at", "text"}
    assert thread["fetched_at"] == 500 and thread["month"] == "2026-11"


def test_get_json_retries_on_server_errors_then_succeeds() -> None:
    busy = urllib.error.HTTPError("u", 503, "busy", None, None)
    api = FakeAPI({"items/1": [busy, busy, {"ok": True}]})
    sleeps: list[float] = []
    assert client(api, sleeps).get_json("items/1") == {"ok": True}
    assert len(api.calls) == 3 and sleeps == [2.0, 4.0]


def test_get_json_gives_up_after_the_last_retry_and_does_not_retry_404() -> None:
    api = FakeAPI({"items/1": [urllib.error.URLError("down")]})
    with pytest.raises(hn.HNError):
        hn.Client(opener=api, sleep=lambda _: None, delay=0, retries=2).get_json("items/1")
    assert len(api.calls) == 3
    missing = FakeAPI({"items/2": [urllib.error.HTTPError("u", 404, "gone", None, None)]})
    with pytest.raises(hn.HNError, match="HTTP 404"):
        client(missing).get_json("items/2")
    assert len(missing.calls) == 1


def test_client_waits_between_requests() -> None:
    api = FakeAPI({"items/1": {"ok": True}})
    sleeps: list[float] = []
    ticks = iter([0.0, 0.25, 1.0])
    waiter = hn.Client(opener=api, sleep=sleeps.append, delay=1.0, clock=lambda: next(ticks))
    waiter.get_json("items/1")
    waiter.get_json("items/1")
    assert sleeps == [0.75]


def sync_api(months: dict[str, int], children: int = 2) -> FakeAPI:
    hits = [
        hit(f"Ask HN: Who is hiring? ({name} {month[:4]})", thread_id, created=month_start(month))
        for month, thread_id in months.items()
        for name in [hn.MONTHS[int(month[5:]) - 1].title()]
    ]
    routes: dict[str, object] = {"search_by_date": {"nbPages": 1, "hits": hits}}
    for thread_id in months.values():
        routes[f"items/{thread_id}"] = item(
            *[comment(thread_id * 100 + n) for n in range(children)]
        )
    return FakeAPI(routes)


def test_sync_downloads_closed_threads_once_and_open_threads_every_time(tmp_path: Path) -> None:
    months = {"2026-09": 9, "2026-11": 11}
    now = month_start("2026-11") + 5 * DAY
    first = hn.sync(client(sync_api(months)), tmp_path, now=now, log=lambda _: None)
    assert first.fetched == ["2026-09", "2026-11"]
    api = sync_api(months)
    second = hn.sync(client(api), tmp_path, now=now + DAY, log=lambda _: None)
    assert second.skipped == ["2026-09"] and second.fetched == ["2026-11"]
    assert not any("items/9" in call for call in api.calls)
    assert hn.load_raw(hn.raw_path(tmp_path, "2026-11"))["fetched_at"] == now + DAY


def test_sync_refresh_downloads_everything_again(tmp_path: Path) -> None:
    months = {"2026-01": 1}
    now = month_start("2026-11")
    hn.sync(client(sync_api(months)), tmp_path, now=now, log=lambda _: None)
    again = hn.sync(client(sync_api(months)), tmp_path, now=now, refresh=True, log=lambda _: None)
    assert again.fetched == ["2026-01"]


def test_sync_keeps_the_stored_copy_when_the_api_returns_a_partial_thread(tmp_path: Path) -> None:
    months = {"2026-11": 11}
    now = month_start("2026-11") + DAY
    hn.sync(client(sync_api(months, children=10)), tmp_path, now=now, log=lambda _: None)
    logged: list[str] = []
    result = hn.sync(
        client(sync_api(months, children=3)), tmp_path, now=now + DAY, log=logged.append
    )
    assert result.kept == ["2026-11"] and logged
    assert len(hn.load_raw(hn.raw_path(tmp_path, "2026-11"))["posts"]) == 10


def test_sync_fails_when_a_thread_with_comments_comes_back_empty(tmp_path: Path) -> None:
    api = sync_api({"2026-11": 11}, children=0)
    with pytest.raises(hn.HNError, match="empty"):
        hn.sync(client(api), tmp_path, now=month_start("2026-11"), log=lambda _: None)


def test_sync_fails_when_no_threads_are_listed(tmp_path: Path) -> None:
    api = FakeAPI({"search_by_date": {"nbPages": 1, "hits": []}})
    with pytest.raises(hn.HNError):
        hn.sync(client(api), tmp_path, log=lambda _: None)


def test_load_all_returns_threads_oldest_first_from_the_start_month(tmp_path: Path, make) -> None:
    for month in ("2026-03", "2026-01", "2025-12"):
        hn.save_raw(hn.raw_path(tmp_path, month), make.thread(month, []))
    assert [thread["month"] for thread in hn.load_all(tmp_path, "2026-01")] == [
        "2026-01",
        "2026-03",
    ]
