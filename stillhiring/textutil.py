"""Turn HN comment HTML into plain text, links and comparable tokens."""

from __future__ import annotations

import re
from html.parser import HTMLParser

from . import config

_URL_RE = re.compile(r"https?://[^\s<>\"'\[\]|]+", re.I)
_URL_TAIL = ".,;:!?)}>'\"*|"
_EMAIL_RE = re.compile(r"[\w.+-]+@((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)
_BARE_DOMAIN_RE = re.compile(r"(?<![\w@/.-])((?:[a-z0-9][a-z0-9-]*\.)+[a-z]{2,})(?![\w-])", re.I)
_TOKEN_RE = re.compile(r"https?://\S+|[^\W_]+(?:['’][^\W_]+)*")


class _Extractor(HTMLParser):
    """Collects text and link targets from the small HTML subset HN emits."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.links: list[str] = []
        self._href: str | None = None
        self._anchor: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in ("p", "pre"):
            self.parts.append("\n\n")
        elif tag == "br":
            self.parts.append("\n")
        elif tag == "a":
            self._flush_anchor()
            self._href = (dict(attrs).get("href") or "").strip()
            self._anchor = []

    def handle_endtag(self, tag: str) -> None:
        if tag in ("p", "pre"):
            self.parts.append("\n\n")
        elif tag == "a":
            self._flush_anchor()

    def handle_data(self, data: str) -> None:
        if self._href is None:
            self.parts.append(data)
        else:
            self._anchor.append(data)

    def close(self) -> None:
        super().close()
        self._flush_anchor()

    def _flush_anchor(self) -> None:
        if self._href is None:
            return
        href, label = self._href, "".join(self._anchor)
        self._href, self._anchor = None, []
        if href.lower().startswith(("http://", "https://")):
            self.links.append(href)
            # HN shortens long link text with "..."; keep the real address so
            # the same link reads the same from month to month.
            if label.lower().startswith(("http://", "https://")) or not label.strip():
                label = href
        self.parts.append(label)


def html_to_text(markup: str) -> tuple[str, list[str]]:
    """Return (plain text with blank lines between paragraphs, link targets)."""
    parser = _Extractor()
    parser.feed(markup or "")
    parser.close()
    text = "".join(parser.parts).replace("\r", "").replace("\xa0", " ")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip(), parser.links


def first_line(text: str) -> str:
    """The first non-empty line: where posts put "Company | Role | Location"."""
    for line in text.split("\n"):
        if line.strip():
            return line.strip()
    return ""


def clean_url(url: str) -> str:
    return url.rstrip(_URL_TAIL)


def find_urls(text: str, links: list[str] | None = None) -> list[str]:
    """Links from <a href> first, then addresses typed as plain text."""
    seen: dict[str, None] = {}
    for url in [*(links or []), *_URL_RE.findall(text)]:
        url = clean_url(url)
        if url:
            seen.setdefault(url, None)
    return list(seen)


def find_email_domains(text: str) -> list[str]:
    """Domains of e-mail addresses in the text, free mail providers excluded."""
    seen: dict[str, None] = {}
    for domain in _EMAIL_RE.findall(text):
        domain = domain.lower()
        if domain not in config.FREEMAIL_DOMAINS:
            seen.setdefault(domain, None)
    return list(seen)


def find_bare_domains(line: str) -> list[str]:
    """Domains written without a scheme ("acme.io"), technologies excluded."""
    line = _URL_RE.sub(" ", line)
    line = _EMAIL_RE.sub(" ", line)
    seen: dict[str, None] = {}
    for match in _BARE_DOMAIN_RE.findall(line):
        domain = match.lower()
        if domain in config.NOT_DOMAINS:
            continue
        if domain.rsplit(".", 1)[-1] in config.BARE_DOMAIN_TLDS:
            seen.setdefault(domain, None)
    return list(seen)


def tokens(text: str) -> list[str]:
    """Lower-cased words for comparing two posts. A URL counts as one word."""
    out: list[str] = []
    for token in _TOKEN_RE.findall(text.lower()):
        if token.startswith("http"):
            token = clean_url(token)
        out.append(token)
    return out
