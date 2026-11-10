"""Download "Ask HN: Who is hiring?" threads through the Algolia HN API.

Only top-level comments are kept: each one is a job post. Raw threads hold the
full text of every post, so they stay on disk under data/raw and are never
published or committed.
"""

from __future__ import annotations

import gzip
import json
import os
import re
import time
import urllib.error
import urllib.request
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlencode

from . import config

MONTHS = (
    "january february march april may june july august september october november december"
).split()
_TITLE_RE = re.compile(
    r"^\s*Ask HN: Who is hiring\?\s*\((" + "|".join(MONTHS) + r")\s+(\d{4})\)\s*$", re.I
)
_RETRY_STATUS = frozenset({429, 500, 502, 503, 504})


class HNError(RuntimeError):
    """The API could not be reached or returned something unusable."""


@dataclass(frozen=True)
class ThreadRef:
    month: str  # YYYY-MM, taken from the title
    id: int
    title: str
    created_at: int
    num_comments: int


def month_from_title(title: str) -> str | None:
    """'Ask HN: Who is hiring? (June 2021)' -> '2021-06'; other titles -> None."""
    match = _TITLE_RE.match(title or "")
    if not match:
        return None
    return f"{match.group(2)}-{MONTHS.index(match.group(1).lower()) + 1:02d}"


class Client:
    """Sequential, rate-limited JSON client with retries."""

    def __init__(
        self,
        *,
        user_agent: str = config.USER_AGENT,
        delay: float = config.REQUEST_DELAY,
        retries: int = config.REQUEST_RETRIES,
        timeout: float = config.REQUEST_TIMEOUT,
        opener: Callable[..., object] | None = None,
        sleep: Callable[[float], None] = time.sleep,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.user_agent = user_agent
        self.delay = delay
        self.retries = retries
        self.timeout = timeout
        self._open = opener or urllib.request.urlopen
        self._sleep = sleep
        self._clock = clock
        self._last_request: float | None = None

    def get_json(self, path: str, params: dict[str, object] | None = None) -> dict:
        url = f"{config.ALGOLIA_API}/{path}"
        if params:
            url += "?" + urlencode(params, safe=",")
        for attempt in range(self.retries + 1):
            self._throttle()
            request = urllib.request.Request(
                url, headers={"User-Agent": self.user_agent, "Accept": "application/json"}
            )
            try:
                with self._open(request, timeout=self.timeout) as response:
                    return json.loads(response.read().decode("utf-8"))
            except urllib.error.HTTPError as error:
                if error.code not in _RETRY_STATUS or attempt == self.retries:
                    raise HNError(f"{url}: HTTP {error.code}") from error
            except (urllib.error.URLError, OSError, ValueError) as error:
                if attempt == self.retries:
                    raise HNError(f"{url}: {error}") from error
            self._sleep(min(60.0, 2.0 * 2**attempt))
        raise HNError(f"{url}: no response")  # pragma: no cover - loop always returns or raises

    def _throttle(self) -> None:
        now = self._clock()
        if self._last_request is not None:
            wait = self.delay - (now - self._last_request)
            if wait > 0:
                self._sleep(wait)
                now = self._clock()
        self._last_request = now

    def list_threads(self, start_month: str = config.START_MONTH) -> list[ThreadRef]:
        """Monthly threads from start_month on, oldest first, one per month."""
        by_month: dict[str, ThreadRef] = {}
        page = 0
        while True:
            data = self.get_json(
                "search_by_date",
                {"tags": "story,author_whoishiring", "hitsPerPage": 1000, "page": page},
            )
            for hit in data.get("hits", []):
                month = month_from_title(hit.get("title") or "")
                if month is None or month < start_month:
                    continue
                ref = ThreadRef(
                    month=month,
                    id=int(hit["objectID"]),
                    title=hit["title"].strip(),
                    created_at=int(hit.get("created_at_i") or 0),
                    num_comments=int(hit.get("num_comments") or 0),
                )
                current = by_month.get(month)
                if current is None or ref.num_comments > current.num_comments:
                    by_month[month] = ref
            page += 1
            if page >= int(data.get("nbPages") or 0):
                break
        return [by_month[month] for month in sorted(by_month)]

    def fetch_thread(self, ref: ThreadRef, now: float) -> dict:
        """Download one thread and keep its top-level posts."""
        data = self.get_json(f"items/{ref.id}")
        posts = []
        for child in data.get("children") or []:
            if not child.get("text") or not child.get("author"):
                continue  # deleted
            posts.append(
                {
                    "id": int(child["id"]),
                    "author": child["author"],
                    "created_at": int(child.get("created_at_i") or 0),
                    "text": child["text"],
                }
            )
        posts.sort(key=lambda post: post["id"])
        return {
            "month": ref.month,
            "id": ref.id,
            "title": ref.title,
            "created_at": ref.created_at,
            "fetched_at": int(now),
            "num_comments": ref.num_comments,
            "posts": posts,
        }


# --- Raw thread store -----------------------------------------------------


def raw_path(raw_dir: Path, month: str) -> Path:
    return raw_dir / f"{month}.json.gz"


def load_raw(path: Path) -> dict:
    with gzip.open(path, "rt", encoding="utf-8") as handle:
        return json.load(handle)


def save_raw(path: Path, thread: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    with gzip.open(tmp, "wt", encoding="utf-8") as handle:
        json.dump(thread, handle, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, path)


def load_all(raw_dir: Path, start_month: str = config.START_MONTH) -> list[dict]:
    """Every stored thread from start_month on, oldest first."""
    threads = [load_raw(path) for path in sorted(raw_dir.glob("*.json.gz"))]
    return [thread for thread in threads if thread["month"] >= start_month]


def is_settled(thread: dict) -> bool:
    """True when the thread was already closed at the time it was fetched."""
    age = thread.get("fetched_at", 0) - thread.get("created_at", 0)
    return age >= config.SETTLE_DAYS * 86400


@dataclass
class SyncResult:
    fetched: list[str]
    skipped: list[str]
    kept: list[str]  # months where a suspiciously short download was discarded


def sync(
    client: Client,
    raw_dir: Path,
    *,
    start_month: str = config.START_MONTH,
    now: float | None = None,
    refresh: bool = False,
    log: Callable[[str], None] = print,
) -> SyncResult:
    """Bring data/raw up to date. Closed threads are downloaded once."""
    now = time.time() if now is None else now
    result = SyncResult([], [], [])
    refs = client.list_threads(start_month)
    if not refs:
        raise HNError("the API returned no Who is hiring threads")
    for ref in refs:
        path = raw_path(raw_dir, ref.month)
        cached = load_raw(path) if path.exists() else None
        if cached and cached.get("id") == ref.id and is_settled(cached) and not refresh:
            result.skipped.append(ref.month)
            continue
        thread = client.fetch_thread(ref, now)
        if not thread["posts"] and ref.num_comments > 0:
            raise HNError(f"{ref.month}: thread {ref.id} came back empty")
        if (
            cached
            and cached.get("id") == ref.id
            and len(thread["posts"]) < 0.8 * len(cached["posts"])
        ):
            # The API occasionally serves a partial tree; keep the fuller copy.
            log(f"{ref.month}: got {len(thread['posts'])} posts, keeping {len(cached['posts'])}")
            result.kept.append(ref.month)
            continue
        save_raw(path, thread)
        result.fetched.append(ref.month)
        log(f"{ref.month}: {len(thread['posts'])} posts")
    return result
