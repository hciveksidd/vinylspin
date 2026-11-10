"""Runs, text similarity and per-thread totals.

Every number here is a count of threads or a share of unchanged words. None
of them says whether a job is open, filled or real: a company that is absent
from a thread may simply not have posted, and one that repeats its text may
be hiring continuously.
"""

from __future__ import annotations

import time
from collections import defaultdict
from dataclasses import dataclass, field

from . import config
from .identity import Clustering, Company
from .parse import Post
from .similarity import TokenCache, group_similarity


@dataclass
class Thread:
    index: int
    month: str
    id: int
    created_at: int
    posts: int  # top-level comments, whether or not a company was recognised
    open: bool  # still filling up: absence from it does not end a run
    companies: int = 0
    repeat: float | None = None  # share of companies that also posted the month before
    same_text: float | None = None  # share that did so with nearly the same text
    remote: float | None = None  # share of posts offering remote work
    salary: float | None = None  # share of posts stating pay


@dataclass
class Cell:
    """One company in one thread."""

    index: int
    posts: list[Post]
    similarity: float | None = None  # to the previous thread the company posted in


@dataclass
class CompanyMetrics:
    company: Company
    cells: list[Cell] = field(default_factory=list)
    run: int = 0  # threads in a row, up to now
    same_run: int = 0  # of those, how many in a row with nearly the same text
    same_similarity: float | None = None  # average similarity across same_run
    longest_run: int = 0
    stopped_after: int = 0  # length of the last run, if the company is not posting now
    is_new: bool = False  # first post ever is in the newest thread

    @property
    def first(self) -> int:
        return self.cells[0].index

    @property
    def last(self) -> int:
        return self.cells[-1].index

    @property
    def last_similarity(self) -> float | None:
        return self.cells[-1].similarity


def thread_list(raw_threads: list[dict], now: float | None = None) -> list[Thread]:
    now = time.time() if now is None else now
    threads = [
        Thread(
            index=index,
            month=raw["month"],
            id=raw["id"],
            created_at=raw.get("created_at", 0),
            posts=len(raw["posts"]),
            open=False,
        )
        for index, raw in enumerate(raw_threads)
    ]
    if threads:
        newest = threads[-1]
        newest.open = now - newest.created_at < config.OPEN_DAYS * 86400
    return threads


def runs(present: list[int], similarities: dict[int, float | None], threads: list[Thread]):
    """(run, same_run, same_similarity, longest_run, stopped_after) for one company.

    `present` holds the indexes of the threads the company posted in, ascending.
    """
    streaks: list[list[int]] = []
    for index in present:
        if streaks and streaks[-1][-1] == index - 1:
            streaks[-1].append(index)
        else:
            streaks.append([index])
    longest = max(len(streak) for streak in streaks)
    newest = threads[-1].index
    # While the newest thread is still filling up, not being in it yet is not a gap.
    due = newest - 1 if threads[-1].open and present[-1] != newest else newest
    tail = streaks[-1]
    if tail[-1] < due:
        return 0, 0, None, longest, len(tail)
    same = [tail[-1]]
    scores: list[float] = []
    for index in reversed(tail[1:]):
        score = similarities.get(index)
        if score is None or score < config.SAME_TEXT:
            break
        same.append(index - 1)
        scores.append(score)
    average = sum(scores) / len(scores) if scores else None
    return len(tail), len(same), average, longest, 0


def compute(
    raw_threads: list[dict],
    clustering: Clustering,
    tokens: TokenCache | None = None,
    now: float | None = None,
) -> tuple[list[Thread], list[CompanyMetrics]]:
    """Metrics for every company and totals for every thread."""
    tokens = tokens or TokenCache()
    threads = thread_list(raw_threads, now)
    index_of = {thread.month: thread.index for thread in threads}
    results: list[CompanyMetrics] = []
    seen_in: dict[int, set[str]] = defaultdict(set)
    same_in: dict[int, int] = defaultdict(int)

    for company in clustering.companies:
        by_thread: dict[int, list[Post]] = defaultdict(list)
        for post in company.posts:
            if post.month in index_of:
                by_thread[index_of[post.month]].append(post)
        if not by_thread:
            continue
        cells: list[Cell] = []
        for index in sorted(by_thread):
            cell = Cell(index=index, posts=by_thread[index])
            if cells:
                cell.similarity = group_similarity(cell.posts, cells[-1].posts, tokens)
                if (
                    cells[-1].index == index - 1
                    and cell.similarity is not None
                    and cell.similarity >= config.SAME_TEXT
                ):
                    same_in[index] += 1
            cells.append(cell)
            seen_in[index].add(company.id)
        present = [cell.index for cell in cells]
        run, same_run, same_similarity, longest, stopped = runs(
            present, {cell.index: cell.similarity for cell in cells}, threads
        )
        results.append(
            CompanyMetrics(
                company=company,
                cells=cells,
                run=run,
                same_run=same_run,
                same_similarity=same_similarity,
                longest_run=longest,
                stopped_after=stopped,
                is_new=len(cells) == 1 and present[0] == threads[-1].index,
            )
        )

    owner = clustering.by_post()
    for thread, raw in zip(threads, raw_threads, strict=True):
        thread.companies = len(seen_in[thread.index])
        if thread.index > 0 and thread.companies:
            repeat = len(seen_in[thread.index] & seen_in[thread.index - 1])
            thread.repeat = repeat / thread.companies
            thread.same_text = same_in[thread.index] / thread.companies
        matched = [owner[post["id"]] for post in raw["posts"] if post["id"] in owner]
        if matched:
            mine = [
                post
                for company in {company.id: company for company in matched}.values()
                for post in company.posts
                if post.month == thread.month
            ]
            thread.remote = sum(post.remote == "remote" for post in mine) / len(mine)
            thread.salary = sum(bool(post.salary) for post in mine) / len(mine)
    return threads, results
