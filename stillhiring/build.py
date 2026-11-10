"""Turn raw threads into the JSON files the site reads.

What gets published: post ids, counts, similarity scores and the short fields
of a post's header (roles, location, pay). What never does: the text of a
post, or the name of the account that wrote it. The site fetches text from HN
itself when a visitor opens a diff.
"""

from __future__ import annotations

import json
import shutil
import time
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from . import config, hn, identity, metrics, parse, similarity

COLUMNS = [
    "id",  # stable slug, also the key into c/<shard>.json
    "name",
    "first",  # index of the first thread the company posted in
    "last",  # index of the latest one
    "threads",  # how many threads it posted in
    "run",  # threads in a row up to now (0 = not posting now)
    "same",  # of those, in a row with nearly the same text
    "longest",  # longest run ever
    "stopped",  # length of the last run if it has ended, else 0
    "sim",  # latest post vs the one before, percent, or null
    "avg",  # average similarity across "same", percent, or null
    "strip",  # one character per recent thread, see strip()
]


class BuildError(RuntimeError):
    """The data is not fit to publish."""


@dataclass
class Analysis:
    raw_threads: list[dict]
    posts: list[parse.Post]
    clustering: identity.Clustering
    threads: list[metrics.Thread]
    companies: list[metrics.CompanyMetrics]


def analyze(
    raw_dir: Path,
    *,
    start_month: str = config.START_MONTH,
    overrides_path: Path | None = config.OVERRIDES_PATH,
    now: float | None = None,
) -> Analysis:
    """Parse every stored thread, group posts into companies, compute metrics."""
    raw_threads = hn.load_all(raw_dir, start_month) if raw_dir.exists() else []
    if not raw_threads:
        raise FileNotFoundError(f"no threads in {raw_dir}: run `python -m stillhiring fetch` first")
    posts = sorted(
        (post for thread in raw_threads for post in parse.parse_thread(thread)),
        key=lambda post: (post.month, post.id),
    )
    tokens = similarity.TokenCache()
    clustering = identity.cluster(posts, identity.Overrides.load(overrides_path), tokens)
    threads, companies = metrics.compute(raw_threads, clustering, tokens, now)
    return Analysis(raw_threads, posts, clustering, threads, companies)


def _next_month(month: str) -> str:
    year, number = int(month[:4]), int(month[5:7])
    return f"{year + 1}-01" if number == 12 else f"{year}-{number + 1:02d}"


def check(analysis: Analysis, now: float, allow_gaps: bool = False) -> None:
    """Refuse to publish data that is visibly incomplete."""
    threads = analysis.threads
    if not threads[-1].posts:
        raise BuildError(f"the newest thread ({threads[-1].month}) has no posts")
    if allow_gaps:
        return
    for previous, current in zip(threads, threads[1:], strict=False):
        if current.month != _next_month(previous.month):
            raise BuildError(
                f"no thread between {previous.month} and {current.month}; "
                "fetch again, or pass --allow-gaps if HN really skipped a month"
            )
    today = datetime.fromtimestamp(now, UTC)
    this_month = f"{today.year}-{today.month:02d}"
    if _next_month(threads[-1].month) < this_month:
        raise BuildError(
            f"the newest thread is {threads[-1].month} but it is {this_month}; "
            "fetch again, or pass --allow-gaps to build from old data"
        )


def _percent(value: float | None) -> int | None:
    return None if value is None else round(value * 100)


def strip(company: metrics.CompanyMetrics, total: int, length: int = config.STRIP_LEN) -> str:
    """The last `length` threads as one character each.

    '.' = no post, '+' = the company's first post ever, '0'-'9' = similarity
    to its previous post in tenths ('9' is 90% and up).
    """
    cells = {cell.index: cell for cell in company.cells}
    out = []
    for index in range(max(0, total - length), total):
        cell = cells.get(index)
        if cell is None:
            out.append(".")
        elif cell.similarity is None:
            out.append("+" if index == company.first else "0")
        else:
            out.append(str(min(9, int(cell.similarity * 10))))
    return "".join(out).rjust(length, ".")


def shard_of(company_id: str) -> str:
    """Which c/<shard>.json holds a company: the low byte of its FNV-1a hash.

    site/shard.js computes the same value in the browser.
    """
    value = 0x811C9DC5
    for byte in company_id.encode("utf-8"):
        value = ((value ^ byte) * 0x01000193) & 0xFFFFFFFF
    return f"{value & 0xFF:02x}"


def _first(values) -> str | None:
    return next((value for value in values if value), None)


def _detail(company: metrics.CompanyMetrics) -> dict:
    rows = []
    for cell in company.cells:
        roles: dict[str, str] = {}
        for post in cell.posts:
            for role in post.roles:
                roles.setdefault(role.lower(), role)
        rows.append(
            [
                cell.index,
                [post.id for post in cell.posts],
                _percent(cell.similarity),
                list(roles.values())[:8],
                _first(post.location for post in cell.posts),
                _first(post.remote for post in cell.posts),
                _first(post.salary for post in cell.posts),
            ]
        )
    return {
        "n": company.company.name,
        "names": [list(pair) for pair in company.company.names[:6]],
        "d": company.company.domains[:4],
        "t": rows,
    }


def render(analysis: Analysis, now: float) -> dict[str, object]:
    """Every output file as {relative path: JSON-ready value}."""
    threads = analysis.threads
    ordered = sorted(
        analysis.companies,
        key=lambda c: (-c.run, -c.same_run, -len(c.cells), c.company.name.lower(), c.company.id),
    )
    rows = []
    shards: dict[str, dict[str, dict]] = defaultdict(dict)
    for company in ordered:
        rows.append(
            [
                company.company.id,
                company.company.name,
                company.first,
                company.last,
                len(company.cells),
                company.run,
                company.same_run,
                company.longest_run,
                company.stopped_after,
                _percent(company.last_similarity),
                _percent(company.same_similarity),
                strip(company, len(threads)),
            ]
        )
        shards[shard_of(company.company.id)][company.company.id] = _detail(company)

    def share(value: float | None) -> float | None:
        return None if value is None else round(value, 3)

    matched = sum(len(company.company.posts) for company in analysis.companies)
    meta = {
        "built_at": datetime.fromtimestamp(now, UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "strip_len": config.STRIP_LEN,
        "thresholds": {
            "same_text": config.SAME_TEXT,
            "long_run": config.LONG_RUN,
            "stopped_min_run": config.STOPPED_MIN_RUN,
            "open_days": config.OPEN_DAYS,
        },
        "totals": {
            "threads": len(threads),
            "posts": len(analysis.posts),
            "matched_posts": matched,
            "companies": len(rows),
        },
        "columns": COLUMNS,
        "threads": [
            {
                "m": thread.month,
                "id": thread.id,
                "posts": thread.posts,
                "companies": thread.companies,
                "repeat": share(thread.repeat),
                "same": share(thread.same_text),
                "remote": share(thread.remote),
                "salary": share(thread.salary),
                "open": thread.open,
            }
            for thread in threads
        ],
    }
    files: dict[str, object] = {"meta.json": meta, "companies.json": {"rows": rows}}
    for shard, companies in shards.items():
        files[f"c/{shard}.json"] = companies
    return files


def build(
    raw_dir: Path,
    out_dir: Path,
    *,
    start_month: str = config.START_MONTH,
    overrides_path: Path | None = config.OVERRIDES_PATH,
    now: float | None = None,
    allow_gaps: bool = False,
) -> dict[str, int]:
    """Write the site's data files and return a few totals."""
    now = time.time() if now is None else now
    analysis = analyze(raw_dir, start_month=start_month, overrides_path=overrides_path, now=now)
    check(analysis, now, allow_gaps)
    files = render(analysis, now)
    shutil.rmtree(out_dir / "c", ignore_errors=True)  # shards of companies that no longer exist
    for relative, payload in files.items():
        path = out_dir / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_name(path.name + ".tmp")
        tmp.write_text(
            json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
        )
        tmp.replace(path)
    return {
        "threads": len(analysis.threads),
        "posts": len(analysis.posts),
        "companies": len(analysis.companies),
    }
