"""A plain-text report: how well the parser and the matching are doing.

Read it after changing a rule. The lists at the end are the matches most
likely to be wrong; settle them in overrides.json.
"""

from __future__ import annotations

import re
from collections import Counter
from pathlib import Path

from . import build, config, identity


def _share(part: int, whole: int) -> str:
    return f"{100 * part / whole:.1f}%" if whole else "n/a"


def _families(company: identity.Company) -> Counter:
    families: Counter = Counter()
    for spelling, count in company.names:
        tokens = identity.name_tokens(spelling)
        if tokens:
            families[tokens[0]] += count
    return families


def report(
    raw_dir: Path,
    *,
    start_month: str = config.START_MONTH,
    top: int = 15,
    overrides_path: Path | None = config.OVERRIDES_PATH,
    now: float | None = None,
) -> str:
    analysis = build.analyze(
        raw_dir, start_month=start_month, overrides_path=overrides_path, now=now
    )
    posts, threads, companies = analysis.posts, analysis.threads, analysis.companies
    named = [post for post in posts if post.company]
    newest_year = threads[-1].month[:4]
    recent = [post for post in named if post.month.startswith(newest_year)]
    lines: list[str] = []
    out = lines.append

    out(f"Threads    {len(threads)}  ({threads[0].month} to {threads[-1].month})")
    out(f"Posts      {len(posts)}")
    out(f"Companies  {len(companies)}")
    peak = max(threads, key=lambda thread: thread.posts)
    out(f"Peak       {peak.posts} posts in {peak.month}; newest thread has {threads[-1].posts}")
    out("")
    out("Parser coverage")
    out(f"  company recognised   {_share(len(named), len(posts))} of posts")
    out(f"  roles                {_share(sum(bool(p.roles) for p in named), len(named))}")
    out(f"  location             {_share(sum(bool(p.location) for p in named), len(named))}")
    out(f"  remote policy        {_share(sum(bool(p.remote) for p in named), len(named))}")
    out(
        f"  pay                  {_share(sum(bool(p.salary) for p in named), len(named))} overall, "
        f"{_share(sum(bool(p.salary) for p in recent), len(recent))} in {newest_year}"
    )
    out("")
    out("Matching")
    matched = sum(len(company.company.posts) for company in companies)
    out(f"  posts in a company   {_share(matched, len(posts))}")
    out(f"  posts left unmatched {len(analysis.clustering.unmatched)}")
    out(
        f"  links not used       {len(analysis.clustering.shared_keys)} (shared by unrelated names)"
    )
    out(f"  same name kept apart {len(analysis.clustering.conflicts)}")
    out("")
    out("Site filters")
    long_same = [c for c in companies if c.same_run >= config.LONG_RUN]
    stopped = [c for c in companies if c.stopped_after >= config.STOPPED_MIN_RUN]
    out(f"  same text, {config.LONG_RUN}+ in a row      {len(long_same)}")
    out(f"  stopped after {config.STOPPED_MIN_RUN}+ in a row   {len(stopped)}")
    out(f"  first post this month        {sum(c.is_new for c in companies)}")
    out("")
    out(f"Longest runs of nearly the same text (top {top})")
    for company in sorted(long_same, key=lambda c: (-c.same_run, c.company.name))[:top]:
        average = f"{100 * company.same_similarity:.0f}%" if company.same_similarity else "n/a"
        out(f"  {company.same_run:3d} threads, {average:>4} same  {company.company.name}")
    out("")
    out(f"Links not used to match companies (top {top} by posts)")
    shared = sorted(analysis.clustering.shared_keys.items(), key=lambda item: (-item[1], item[0]))
    for key, count in shared[:top]:
        out(f"  {count:4d}  {key}")
    out("")
    out(f"Same name, different domains, kept apart (top {top} by posts)")
    conflicts = sorted(
        analysis.clustering.conflicts,
        key=lambda conflict: -sum(group["posts"] for group in conflict["groups"]),
    )
    for conflict in conflicts[:top]:
        groups = "  |  ".join(
            f"{group['posts']} posts {', '.join(group['domains'][:2]) or 'no domain'}"
            for group in conflict["groups"]
        )
        out(f"  {conflict['name']}: {groups}")
    out("")
    out(f"Companies merged from three or more unrelated names (top {top})")
    mixed = [(len(_families(c.company)), c) for c in companies if len(_families(c.company)) >= 3]
    for _, company in sorted(mixed, key=lambda item: (-item[0], item[1].company.id))[:top]:
        names = ", ".join(f"{spelling} ({count})" for spelling, count in company.company.names[:5])
        out(f"  {company.company.id}: {names}")
    return "\n".join(lines)


def describe(
    raw_dir: Path,
    pattern: str,
    *,
    start_month: str = config.START_MONTH,
    overrides_path: Path | None = config.OVERRIDES_PATH,
) -> str:
    """Everything known about the companies whose name or domain matches a pattern."""
    analysis = build.analyze(raw_dir, start_month=start_month, overrides_path=overrides_path)
    regex = re.compile(pattern, re.IGNORECASE)
    lines: list[str] = []
    for company in analysis.companies:
        details = company.company
        haystack = [details.name, details.id, *[n for n, _ in details.names], *details.domains]
        if not any(regex.search(text) for text in haystack):
            continue
        months = [analysis.threads[cell.index].month for cell in company.cells]
        lines.append(f"{details.id}: {details.name}")
        lines.append(f"  names    {', '.join(f'{n} ({c})' for n, c in details.names) or '-'}")
        lines.append(f"  domains  {', '.join(details.domains) or '-'}")
        lines.append(f"  keys     {', '.join(sorted(details.keys))}")
        lines.append(
            f"  threads  {len(months)} ({months[0]} to {months[-1]}), run {company.run}, "
            f"same text {company.same_run}, longest {company.longest_run}"
        )
        lines.append(f"  posts    {' '.join(str(post.id) for post in details.posts[-12:])}")
    return "\n".join(lines) or f"no company matches {pattern!r}"
