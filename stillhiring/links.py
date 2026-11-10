"""What a link says about who posted it: ATS slug, own domain, name match."""

from __future__ import annotations

import re
from functools import cache
from urllib.parse import SplitResult, parse_qs, urlsplit

from . import config

_ATS = [
    (provider, re.compile(rf"^(?:www\.)?{host}$"), where)
    for provider, host, where in config.ATS_RULES
]
_AFFIX_RE = re.compile(
    r"^(?:get|try|join|use|go|hello|hey|with|team|meet|we|the|my)|"
    r"(?:hq|app|labs?|ai|io|inc|co|tech|team|jobs|careers|group|global|corp|software|studio)$"
)
_CAREERS_RE = re.compile(
    r"(?:^|[/.])(?:careers?|jobs?|join(?:-us)?|hiring|work-with-us|open-positions|positions|"
    r"vacancies|team|company)(?:[/.?#]|$)",
    re.I,
)


def _split(url: str) -> SplitResult:
    """urlsplit that accepts bare domains and survives malformed addresses."""
    try:
        return urlsplit(url if "://" in url else "//" + url)
    except ValueError:
        return urlsplit("")


def host_of(url: str) -> str:
    """'https://www.Acme.com:443/jobs' -> 'acme.com'. Accepts bare domains too."""
    host = (_split(url).hostname or "").lower().rstrip(".")
    return host[4:] if host.startswith("www.") else host


@cache
def registrable_domain(host: str) -> str | None:
    """'jobs.acme.co.uk' -> 'acme.co.uk'; None for IP addresses and single labels."""
    labels = host.split(".")
    if len(labels) < 2 or labels[-1].isdigit():
        return None
    if not all(re.fullmatch(r"[a-z0-9]([a-z0-9-]*[a-z0-9])?", label) for label in labels):
        return None
    size = 3 if ".".join(labels[-2:]) in config.MULTI_PART_SUFFIXES else 2
    if len(labels) < size:
        return None
    return ".".join(labels[-size:])


def domain_label(domain: str) -> str:
    """'acme-labs.co.uk' -> 'acmelabs': the part of a domain that names its owner."""
    return re.sub(r"[^a-z0-9]", "", domain.split(".", 1)[0])


def is_generic(host: str) -> bool:
    """True for shorteners, social networks and other hosts that identify nobody."""
    if host in config.GENERIC_HOSTS:
        return True
    domain = registrable_domain(host)
    return domain is None or domain in config.GENERIC_HOSTS


def ats_key(url: str) -> tuple[str, str] | None:
    """('lever', 'acme') for https://jobs.lever.co/acme/123, None for other links."""
    parts = _split(url)
    host = (parts.hostname or "").lower()
    segments = [segment for segment in parts.path.split("/") if segment]
    for provider, pattern, where in _ATS:
        match = pattern.match(host)
        if not match:
            continue
        slug = None
        if where == "sub":
            slug = match.group(1)
        elif where == "path":
            slug = segments[0] if segments else None
        elif where.startswith("path:"):
            lowered = [segment.lower() for segment in segments]
            prefix = where.split(":", 1)[1]
            if prefix in lowered[:-1]:
                slug = segments[lowered.index(prefix) + 1]
        elif where.startswith("query:"):
            values = parse_qs(parts.query).get(where.split(":", 1)[1])
            slug = values[0] if values else None
        if slug:
            slug = slug.lower().strip()
            if slug not in config.ATS_RESERVED_SLUGS and re.fullmatch(
                r"[a-z0-9][a-z0-9._-]*", slug
            ):
                return provider, slug
    return None


def own_domain(url: str) -> str | None:
    """The registrable domain of a link, unless the host is an ATS or generic."""
    host = host_of(url)
    if not host or ats_key(url) or is_generic(host):
        return None
    return registrable_domain(host)


def is_careers_link(url: str) -> bool:
    """True for acme.com/careers, jobs.acme.com and similar."""
    parts = _split(url)
    return bool(_CAREERS_RE.search((parts.hostname or "") + parts.path))


def letters(text: str) -> str:
    return re.sub(r"[^a-z0-9]", "", text.lower())


def _bare(text: str) -> str:
    """'getacme' -> 'acme', 'acmelabs' -> 'acme': drop the usual padding."""
    stripped = _AFFIX_RE.sub("", text)
    return stripped if len(stripped) >= 3 else text


def _abbreviates(label: str, words: list[str]) -> bool:
    """True when the label is built from the starts of the words, in order.

    'allenai' abbreviates Allen Institute for AI, 'ibm' abbreviates
    International Business Machines. The first word must take part.
    """
    if len(label) < 3 or len(words) < 2:
        return False

    def fit(position: int, start: int, used: int) -> bool:
        if position == len(label):
            return used >= 2
        for index in range(start, len(words)):
            word = words[index]
            size = 0
            while (
                size < len(word)
                and position + size < len(label)
                and label[position + size] == word[size]
            ):
                size += 1
            if any(fit(position + take, index + 1, used + 1) for take in range(size, 0, -1)):
                return True
            if used == 0:
                return False
        return False

    return fit(0, 0, 0)


def name_matches_label(name: str, label: str) -> bool:
    """Does a company name fit a domain label or ATS slug?

    'Acme Labs' fits 'acmelabs', 'acme', 'getacme' and 'acmehq';
    'Allen Institute for AI' fits 'allenai'.
    """
    words = re.findall(r"[a-z0-9]+", name.lower())
    if words[:1] == ["the"]:
        words = words[1:]
    name, label = "".join(words), letters(label)
    if len(name) < 2 or len(label) < 2:
        return False
    if {name, _bare(name)} & {label, _bare(label)}:
        return True
    short, long = sorted((name, label), key=len)
    if len(short) >= 4 and long.startswith(short):
        return True
    return _abbreviates(label, words)


def link_labels(urls: list[str]) -> set[str]:
    """Domain labels and ATS slugs of the links in a post."""
    labels: set[str] = set()
    for url in urls:
        key = ats_key(url)
        if key:
            labels.add(letters(key[1]))
            continue
        domain = own_domain(url)
        if domain:
            labels.add(domain_label(domain))
    labels.discard("")
    return labels
