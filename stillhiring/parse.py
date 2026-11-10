"""Read a job post: company, roles, location, remote policy and pay.

Most posts open with a header line such as

    Acme (YC W21) | Senior Backend Engineer | Berlin or REMOTE (EU) | €80k-€110k

but nothing enforces the format, so every rule here is a heuristic. When a
rule turns out wrong, add the offending header to tests/cases/headers.json
before fixing it.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from . import links as linkinfo
from . import textutil

# --- Vocabulary -----------------------------------------------------------

_PIPE_CHARS = "|｜│¦‖•·▪►"
_PIPE_RE = re.compile(rf"\s*[{re.escape(_PIPE_CHARS)}]+\s*")
_DASH_RE = re.compile(r"\s+(?:-{1,3}|–|—|―|~|//|::)\s+|\s+[–—]|[–—]\s+")
_SLASH_RE = re.compile(r"\s+/\s*|\s*/\s+")
_PAREN_RE = re.compile(r"\s*[(\[]([^()\[\]]*)[)\]]")

# Words a job title is built around.
_TITLE_NOUN = (
    r"engineers?|developers?|programmers?|scientists?|designers?|architects?|managers?|"
    r"directors?|analysts?|researchers?|interns?|sres?|devops|administrators?|admins?|"
    r"technicians?|specialists?|consultants?|recruiters?|sourcers?|writers?|strategists?|"
    r"counsel|attorneys?|accountants?|controllers?|marketers?|representatives?|"
    r"advocates?|evangelists?|coordinators?|testers?|generalists?|co-?founders?|"
    r"cto|cfo|coo|cmo|cpo|ciso|svp|tpm|swe|swes|sde|sdet|mle|sdr|bdr|csm|dba|postdocs?"
)
# Also part of titles, but common in company names and descriptions too.
_TITLE_WEAK = (
    r"leads?|officers?|executives?|associates?|assistants?|fellows?|vp|pm|qa|"
    r"head of \w+|chief of staff|full[- ]?stack|front[- ]?end|back[- ]?end|engineering"
)
_TITLE_RE = re.compile(rf"(?<![\w.-])(?:{_TITLE_NOUN}|{_TITLE_WEAK})(?![\w-])", re.I)
_STRONG_TITLE_RE = re.compile(rf"(?<![\w.-])(?:{_TITLE_NOUN})(?![\w-])", re.I)
# A segment that ends in a title noun, or opens with a seniority word and
# contains one, reads as a job title rather than a company name.
_TITLE_END_RE = re.compile(rf"(?<![\w.-])(?:{_TITLE_NOUN})\s*(?:\(.*\)?)?$", re.I)
_SENIORITY_START_RE = re.compile(
    r"^(?:senior|sr\.?|junior|jr\.?|staff|principal|lead|founding|head\s+of|vp|director|"
    r"deputy|chief|mid[- ]level|experienced)\b",
    re.I,
)
_GENERIC_ROLES_RE = re.compile(
    r"\b(?:multiple|various|several|many|all|numerous|other|more|misc\.?)\s+(?:\w+\s+)?"
    r"(?:roles?|positions?|openings?|jobs)\b|\b(?:roles?|positions?)\s+across\b",
    re.I,
)
_ROLE_LABEL_RE = re.compile(
    r"^(?:open\s+)?(?:roles?|positions?|openings?|hiring(?:\s+for)?|looking\s+for|"
    r"we(?:'re|’re|\s+are)\s+hiring(?:\s+for)?)\s*:\s*",
    re.I,
)
_SENTENCE_RE = re.compile(
    r"\b(?:we|our|you|your|is|are|will|have|has|that|this|their|they|who|what|if|can|must|"
    r"should|please|about|experience|years?)\b",
    re.I,
)

_NOT_REMOTE_RE = re.compile(r"\b(?:no|not|non)[- ]remote\b", re.I)
_REMOTE_RE = re.compile(
    r"\b(?:remote|wfh|work[- ]from[- ]home|distributed|anywhere|telecommute)\b", re.I
)
_HYBRID_RE = re.compile(r"\bhybrid\b", re.I)
_ONSITE_RE = re.compile(
    r"\b(?:on-?\s?site|in[- ]office|in[- ]person|office[- ]based|on[- ]prem(?:ise)?s?)\b", re.I
)
_EMPLOYMENT_RE = re.compile(
    r"\b(full[- ]?time|part[- ]?time|contract(?:or|ors|s)?|intern(?:ship)?s?|freelance|"
    r"permanent|temporary|fte|co-?op)\b",
    re.I,
)
_VISA_RE = re.compile(r"\b(?:visa|sponsor(?:ship|ed)?|h-?1b|relocation)\b", re.I)
_FILLER_RE = re.compile(
    r"\b(?:and|or|only|ok|okay|friendly|first|fully|100%|preferred|possible|available|"
    r"position|positions|role|roles|paid|both|yes|no|not|non|us|usa|eu|uk|worldwide|global|"
    r"timezones?|time zones?|based|optional|flexible|team|work|working)\b",
    re.I,
)

_CUR = r"(?:USD|EUR|GBP|CAD|AUD|CHF|SGD|NZD|SEK|PLN|INR|US\$|CA\$|C\$|A\$)"
_SYM = r"[$€£]"
_NUM = r"\d{2,3}(?:[.,]\d{3})?"
_NOT_FUNDING = r"(?!\s?(?:[mb]\b|mm\b|bn\b|million|billion|\+?\s?(?:arr|mrr|raised|funding|users)))"
_RANGE = r"\s?(?:-|–|—|to)\s?"
_SALARY_RE = re.compile(
    "|".join(
        [
            # $60/hr, $50-70 per hour (first, or "$60" alone would win and be discarded)
            rf"{_SYM}\s?\d{{2,3}}(?:{_RANGE}{_SYM}?\s?\d{{2,3}})?\s?(?:/|per\s)\s?(?:hr|hour|h)\b",
            # $120k, €80,000, $120k-$150k, $120-150k, with optional currency code
            rf"(?:{_CUR}\s?)?{_SYM}\s?{_NUM}\s?k?(?:{_RANGE}{_SYM}?\s?{_NUM}\s?k?)?"
            rf"{_NOT_FUNDING}(?:\s?{_CUR})?",
            # 120k-150k, 120-150k, with optional currency code on either side
            rf"(?:{_CUR}\s?)?(?<![\w.]){_NUM}\s?k?{_RANGE}{_NUM}\s?k\b(?:\s?{_CUR})?",
            # 150k USD, EUR 70k
            rf"(?<![\w.]){_NUM}\s?k\s?{_CUR}\b|{_CUR}\s?{_NUM}\s?k\b",
        ]
    ),
    re.I,
)
# Cheap test that rules out most text before the pattern above runs.
_SALARY_HINT_RE = re.compile(rf"{_SYM}\s?\d|\d\s?k\b|{_CUR}", re.I)
# A match must look like yearly or hourly pay: "$50" alone is not a salary.
_SALARY_MIN_RE = re.compile(r"\d{2,3}[.,]\d{3}|\d{2,3}\s?k|/\s?h|per\s+h", re.I)

_YC_RE = re.compile(r"\bYC\s?-?\s?([WSFX]\s?'?\d{2}|[A-Z]{1,2}\d{2})\b", re.I)
_ALIAS_RE = re.compile(
    r"^(?:formerly|previously|prev\.?|fka|f/k/a|aka|a\.k\.a\.?|née|was)\s+(.+)$", re.I
)
_LABEL_RE = re.compile(r"^(?:company(?:\s+name)?|who|employer|organi[sz]ation)\s*[:=]\s*", re.I)
_NAME_WORD = r"[A-Z0-9][\w.&'’+-]*"
# "Acme is hiring ...", "Acme Robotics builds ...", "At Acme, we ..."
_SENTENCE_NAME_RE = re.compile(
    rf"^(?:At\s+)?({_NAME_WORD}(?:\s+(?:{_NAME_WORD}|of|for|the|and|by)){{0,4}}?)"
    r"(?:\s*\([^)]*\))?,?\s+"
    r"(?:is|are|was|we|we're|we’re|builds?|enables?|helps?|makes?|provides?|offers?|"
    r"develops?|creates?|lets|seeks?|has|needs?)\b"
)
_HIRING_TAIL_RE = re.compile(
    r"\s*(?:,|-|–|—)?\s+(?:"
    r"(?:is|are|we're|we’re|we are)\s+(?:now\s+|actively\s+|still\s+)?"
    r"(?:hiring|looking\s+for|seeking|recruiting)"
    r"|(?:now\s+|actively\s+)?hiring|looking\s+for|seeking"
    r")\b.*$",
    re.I,
)
# Sentence openers and field labels that are never a company on their own.
_STOP_NAMES = frozenset(
    """
    we we're we’re we've our i i'm i’m hi hello hey hiring looking seeking this it there
    here what who why how as in on for to with from my your their they you he she all any some
    each every most many several one two both please note also and but or so if when while
    since because after before now today currently recently just still yes no not new more
    want interested come apply location role position title job description update edit ps
    remote onsite on-site hybrid n/a tbd unknown company companies startup stealth confidential
    freelancer thanks thank good great nice cool sorry
    """.split()
)
_STOP_PHRASES = frozenset(
    {
        "seeking work", "seeking freelancer", "the team", "the position", "the role", "the job",
        "the company", "hi all", "hi hn", "hello hn", "hey hn", "hacker news",
    }
)  # fmt: skip

_REGIONS = (
    "worldwide global anywhere europe european eu emea apac latam americas asia africa "
    "usa uk canada mexico brazil argentina colombia chile germany france spain "
    "portugal italy netherlands belgium switzerland austria sweden norway denmark finland "
    "ireland poland czechia romania bulgaria greece turkey israel uae india singapore japan "
    "korea china taiwan australia zealand nigeria kenya egypt ukraine estonia latvia "
    "lithuania hungary serbia croatia england scotland wales california texas florida "
    "washington massachusetts colorado illinois georgia virginia oregon utah ohio michigan "
    "pennsylvania carolina arizona minnesota"
).split()
_CITIES = (
    "san francisco|bay area|silicon valley|new york|nyc|brooklyn|manhattan|los angeles|"
    "seattle|boston|cambridge|austin|denver|boulder|chicago|atlanta|miami|portland|san diego|"
    "san jose|palo alto|mountain view|menlo park|sunnyvale|redwood city|oakland|berkeley|"
    "washington dc|philadelphia|pittsburgh|raleigh|durham|salt lake city|dallas|houston|"
    "phoenix|minneapolis|detroit|toronto|vancouver|montreal|montréal|waterloo|ottawa|london|"
    "oxford|edinburgh|manchester|bristol|dublin|paris|berlin|munich|münchen|hamburg|cologne|"
    "frankfurt|amsterdam|rotterdam|utrecht|brussels|zurich|zürich|geneva|lausanne|vienna|"
    "stockholm|gothenburg|copenhagen|oslo|helsinki|tallinn|riga|vilnius|warsaw|krakow|prague|"
    "budapest|bucharest|sofia|athens|lisbon|porto|madrid|barcelona|valencia|milan|rome|"
    "tel aviv|dubai|bangalore|bengaluru|mumbai|delhi|hyderabad|pune|chennai|hong kong|tokyo|"
    "seoul|shanghai|beijing|shenzhen|taipei|sydney|melbourne|brisbane|auckland|wellington|"
    "são paulo|sao paulo|buenos aires|mexico city|bogotá|bogota|santiago|lagos|nairobi|"
    "cape town|johannesburg|kyiv|istanbul"
)
_PLACE_RE = re.compile(
    rf"(?<![\w-])(?:{_CITIES}|" + "|".join(re.escape(r) for r in _REGIONS) + r")(?![\w-])", re.I
)
_ABBR_PLACE_RE = re.compile(r"(?<![\w-])(?:US|U\.S\.A?\.?|U\.K\.|SF|LA|DC|NZ)(?![\w-])")
_CITY_STATE_RE = re.compile(r"\b[A-Z][\w.'-]+(?: [A-Z][\w.'-]+){0,2},\s?[A-Z]{2}\b")
# A department ("Engineering | Acme | ...") or a date on the first line.
_NOT_A_COMPANY_RE = re.compile(
    r"^(?:engineering|product|design|data|sales|marketing|operations|software|backend|"
    r"frontend|fullstack|full[- ]stack|tech|technology|team|careers|jobs|"
    r"(?:january|february|march|april|may|june|july|august|september|october|november|"
    r"december)\s+\d{4})$",
    re.I,
)
_COMPASS_RE = re.compile(
    r"\b(?:north|south|east|west|central|greater|metro|area|city|region|within|the|in)\b", re.I
)
_POLICY_START_RE = re.compile(r"^(?:fully\s+|100%\s+)?(?:remote|on-?site|hybrid)\b", re.I)
_JOB_WORD_RE = re.compile(r"\b(?:jobs?|roles?|positions?|openings?|opportunit(?:y|ies))\b", re.I)

MAX_ROLES = 12
MAX_FIELD = 80
MAX_HEADER = 600  # a first line longer than this has the body glued to it
MAX_SEGMENT = 110


@dataclass
class Post:
    id: int
    month: str
    author: str
    created_at: int
    text: str  # plain text of the whole post; never published
    links: list[str]  # every address in the post
    header: str
    header_links: list[str]  # addresses and bare domains in the header line
    company: str | None = None
    aliases: list[str] = field(default_factory=list)
    yc: str | None = None
    roles: list[str] = field(default_factory=list)
    location: str | None = None
    remote: str | None = None  # "remote" | "hybrid" | "onsite"
    salary: str | None = None
    employment: list[str] = field(default_factory=list)


# --- Small helpers --------------------------------------------------------


def _split_top_level(text: str, delimiter: re.Pattern[str]) -> list[str]:
    """Split on the delimiter, but not inside parentheses or brackets."""
    parts, depth, start, index = [], 0, 0, 0
    while index < len(text):
        char = text[index]
        if char in "([":
            depth += 1
        elif char in ")]":
            depth = max(0, depth - 1)
        elif depth == 0:
            match = delimiter.match(text, index)
            if match and match.end() > index:
                parts.append(text[start:index])
                start = index = match.end()
                continue
        index += 1
    parts.append(text[start:])
    return parts


def _strip_decoration(text: str) -> str:
    text = re.sub(r"[*_`]+", "", text)
    text = re.sub(r"[(\[][^)\]]*$", "", text)  # unbalanced "(" left by a cut-off header
    text = re.sub(r"^[^\w(.]+", "", text)
    text = re.sub(r"[\s:;,\-–—|/\\>~@&]+$", "", text)
    return re.sub(r"\s+", " ", text).strip()


def _is_only(pattern: re.Pattern[str], text: str) -> bool:
    """True when nothing meaningful is left after removing pattern matches."""
    if not pattern.search(text):
        return False
    rest = _FILLER_RE.sub(" ", pattern.sub(" ", text))
    return not re.search(r"[^\W_]{2,}", rest)


def _dedupe(items: list[str], limit: int) -> list[str]:
    seen: dict[str, str] = {}
    for item in items:
        if item and item.lower() not in seen:
            seen[item.lower()] = item
    return list(seen.values())[:limit]


def _letters(text: str) -> str:
    return re.sub(r"[^a-z0-9]", "", text.lower())


def _initials(text: str) -> str:
    words = [w for w in re.findall(r"[^\W_]+", text) if w.lower() not in ("for", "of", "the")]
    return "".join(word[0] for word in words).lower()


# --- Classifying segments -------------------------------------------------


def looks_like_role(text: str) -> bool:
    return bool(_GENERIC_ROLES_RE.search(text) or _TITLE_RE.search(text))


def reads_as_title(text: str) -> bool:
    """True for 'Senior Backend Engineer'; False for 'Lead Bank' or 'Designer Fund'."""
    if _GENERIC_ROLES_RE.search(text) or _TITLE_END_RE.search(text):
        return True
    if len(text.split()) >= 3 and _STRONG_TITLE_RE.search(text):
        return True
    start = _SENIORITY_START_RE.match(text)
    return bool(start and _TITLE_RE.search(text, start.end()))


def looks_like_place(text: str) -> bool:
    if len(text.split()) > 12:
        return False  # a sentence that happens to mention a place
    return bool(
        _PLACE_RE.search(text) or _ABBR_PLACE_RE.search(text) or _CITY_STATE_RE.search(text)
    )


def _is_only_place(text: str) -> bool:
    if not looks_like_place(text):
        return False
    rest = text
    for pattern in (
        _CITY_STATE_RE,
        _PLACE_RE,
        _ABBR_PLACE_RE,
        _REMOTE_RE,
        _ONSITE_RE,
        _FILLER_RE,
        _COMPASS_RE,
    ):
        rest = pattern.sub(" ", rest)
    return not re.search(r"[^\W_]{3,}", rest)


def remote_policy(text: str) -> str | None:
    if _HYBRID_RE.search(text):
        return "hybrid"
    if _NOT_REMOTE_RE.search(text):
        return "onsite"
    if _REMOTE_RE.search(text):
        return "remote"
    if _ONSITE_RE.search(text):
        return "onsite"
    return None


def find_salary(text: str) -> str | None:
    if not _SALARY_HINT_RE.search(text):
        return None
    for match in _SALARY_RE.finditer(text):
        found = re.sub(r"\s+", " ", match.group(0)).strip(" ,.;")
        if _SALARY_MIN_RE.search(found):
            return found[:48]
    return None


# --- Header ---------------------------------------------------------------


def split_header(header: str) -> list[str]:
    """Cut the header into segments on the separator the author used."""
    header = header[:MAX_HEADER]
    if any(char in header for char in _PIPE_CHARS):
        parts = _PIPE_RE.split(header)
    elif _DASH_RE.search(header):
        parts = _DASH_RE.split(header)
    elif len(_SLASH_RE.findall(header)) >= 2:
        parts = _SLASH_RE.split(header)
    elif header.count(",") >= 2 and len(header) <= 160:
        parts = _split_top_level(header, re.compile(r","))
    else:
        parts = [header]
    segments: list[str] = []
    for part in parts:
        part = part.strip()
        if not part:
            continue
        if len(part) > MAX_SEGMENT:
            # The body starts here. Keep a leading link, drop the prose.
            urls = textutil.find_urls(part)
            if urls and part.startswith(urls[0]):
                segments.append(urls[0])
            break
        segments.append(part)
    return segments


def plausible_name(name: str, structured: bool, labels: frozenset[str] = frozenset()) -> bool:
    """Could this be a company name?

    `structured` means it led a header with separators, where almost anything
    in first place is the company. `labels` are the domain labels and ATS slugs
    linked from the post: a name that matches one is accepted even when it
    looks like an ordinary word ("Remote" next to a link to remote.com).
    """
    words = name.split()
    if not name or len(name) > 60 or len(words) > 6:
        return False
    if not re.search(r"[^\W_]", name):
        return False
    if any(linkinfo.name_matches_label(name, label) for label in labels):
        return True
    lowered = name.lower()
    if lowered in _STOP_NAMES or lowered in _STOP_PHRASES or _NOT_A_COMPANY_RE.match(name):
        return False
    if " ".join(words[:2]).lower() in _STOP_PHRASES:
        return False
    capitalised = sum(1 for word in words if word[0].isupper() or word[0].isdigit())
    all_capitalised = capitalised == len(words)
    if words[0].lower() in _STOP_NAMES and not (structured and all_capitalised and len(words) <= 3):
        return False  # "Looking for engineers" is out, "Looking Glass" stays
    if not structured and not all_capitalised and len(words) > 2:
        return False
    if len(words) >= 5 and capitalised * 2 < len(words):
        return False  # a sentence, not a name
    if _POLICY_START_RE.match(name) or _is_only_place(name):
        return False
    for pattern in (_EMPLOYMENT_RE, _VISA_RE):
        if _is_only(pattern, name):
            return False
    return not (reads_as_title(name) or find_salary(name))


def clean_company(
    segment: str, structured: bool = True, labels: frozenset[str] = frozenset()
) -> tuple[str | None, list[str], str | None, list[str], str]:
    """Split a header's first segment into (name, aliases, yc batch, links, leftover).

    The leftover is whatever followed the name ("Acme - payments for dentists")
    and is handed back to be classified like any other segment.
    """
    aliases: list[str] = []
    found = textutil.find_urls(segment)
    work = segment
    for url in found:
        work = work.replace(url, " ")
    yc_match = _YC_RE.search(work)
    yc = re.sub(r"[\s']", "", yc_match.group(1)).upper() if yc_match else None

    def _expands(short: str, long: str) -> bool:
        """'Ai2' / 'Allen Institute for AI': is one the initials of the other?"""
        short, initials = _letters(short), _initials(long)
        return bool(short) and (short == initials or re.sub(r"\d", "", short) == initials[:-1])

    def _paren(match: re.Match[str]) -> str:
        inner = match.group(1).strip()
        alias = _ALIAS_RE.match(inner)
        if alias:
            aliases.append(_strip_decoration(alias.group(1)))
        elif (
            inner[:1].isupper()
            and len(inner.split()) >= 2
            and not _YC_RE.search(inner)
            and _expands(work[: match.start()], inner)
        ):
            aliases.append(inner)
        return " "

    work = _PAREN_RE.sub(_paren, work)
    work = _YC_RE.sub(" ", work)
    work = _LABEL_RE.sub("", _strip_decoration(work))

    leftover = ""
    at = re.match(r"^(.+?)\s+@\s*(\S.*)$", work)  # "Senior Engineer @ Acme", "Lab @ Acme"
    if not at:
        at = re.match(r"^(.+?)\s+at\s+(\S.*)$", work)
        if at and not (reads_as_title(at.group(1)) or _JOB_WORD_RE.search(at.group(1))):
            at = None
    if at and not reads_as_title(at.group(2)):
        work, leftover = at.group(2), at.group(1)
    hiring = _HIRING_TAIL_RE.search(work)
    if hiring and hiring.start() > 1:
        work, leftover = work[: hiring.start()], leftover or work[hiring.start() :]
    else:
        pieces = _DASH_RE.split(work, maxsplit=1)
        if len(pieces) == 2:
            work, leftover = pieces[0], leftover or pieces[1]
        elif ": " in work:
            work, tail = work.split(": ", 1)
            leftover = leftover or tail
        elif " / " in work:
            work, tail = work.split(" / ", 1)
            if _expands(work, tail):
                aliases.append(_strip_decoration(tail))
            leftover = leftover or tail
        elif ", " in work and not re.search(r",\s*(?:inc|llc|ltd|gmbh|corp|s\.?a)\b", work, re.I):
            work, tail = work.split(", ", 1)
            leftover = leftover or tail

    found.extend(textutil.find_bare_domains(work))
    name = _strip_decoration(work)
    name = re.sub(r"\s+(?:is\s+)?hiring!?$", "", name, flags=re.I)
    name = re.sub(r"\s+sp\.?\s?z\.?\s?o\.?\s?o\.?$", "", name, flags=re.I).strip()
    if not plausible_name(name, structured, labels):
        name = None
    return name, aliases, yc, found, _strip_decoration(leftover)


def name_from_sentence(header: str) -> str | None:
    """'Acme Robotics is building ...' -> 'Acme Robotics'."""
    match = _SENTENCE_NAME_RE.match(header)
    if not match:
        return None
    name = _strip_decoration(match.group(1))
    return name if plausible_name(name, structured=False) else None


# --- Roles ----------------------------------------------------------------


def split_roles(segment: str) -> list[str]:
    """'Senior Backend Engineer, Staff SRE + all roles' -> three roles."""
    segment = _ROLE_LABEL_RE.sub("", segment.strip())
    loose = re.compile(r"\s*(?:[,;]|\s/\s|\s&\s|\sand\s|\s\+\s)\s*", re.I)
    strict = re.compile(r"\s*[,;]\s*")
    for delimiter in (loose, strict):
        pieces = [p.strip() for p in _split_top_level(segment, delimiter) if p.strip()]
        if len(pieces) > 1 and all(looks_like_role(piece) for piece in pieces):
            return [_clean_role(piece) for piece in pieces]
    return [_clean_role(segment)]


def _clean_role(role: str) -> str:
    if re.fullmatch(r"/.{3,}/[a-z]*", role.strip()):
        return role.strip()[:MAX_FIELD]  # a title written as a regex: leave the joke intact
    role = _strip_decoration(role)
    role = re.sub(r"^(?:and|or|a|an)\s+", "", role, flags=re.I)
    return role[:MAX_FIELD].strip()


def body_roles(lines: list[str]) -> list[str]:
    """Roles listed below the header: bullet lines and 'Roles: a, b, c' lists."""
    roles: list[str] = []
    for raw in lines:
        line = raw.strip()
        if not line:
            continue
        labelled = _ROLE_LABEL_RE.match(line)
        bullet = re.match(r"^(?:[-*•–—>▪◦+]|\d{1,2}[.)])\s+", line)
        if bullet:
            line = line[bullet.end() :]
        line = re.split(r"\s*(?:-|–|—|:|\|)?\s*https?://", line, maxsplit=1)[0].strip()
        if labelled:
            candidates = split_roles(line)
        elif len(line) <= 90 and len(line.split()) <= 9 and not line.endswith("."):
            if not bullet and (_SENTENCE_RE.search(line) or not reads_as_title(line)):
                continue
            # "Senior Engineer - Berlin - €90k": keep the title only.
            candidates = [_DASH_RE.split(line, maxsplit=1)[0]]
        else:
            continue
        for candidate in candidates:
            candidate = _clean_role(candidate)
            if (
                3 <= len(candidate) <= MAX_FIELD
                and _STRONG_TITLE_RE.search(candidate)
                and not _SENTENCE_RE.search(candidate)
            ):
                roles.append(candidate)
        if len(roles) >= MAX_ROLES:
            break
    return roles


# --- Posts ----------------------------------------------------------------


def _tidy_place(segment: str) -> str:
    place = _EMPLOYMENT_RE.sub(" ", segment)
    place = re.sub(r"\s*[,/;&+]\s*(?=[,/;&+]|$)|^\s*[,/;&+]\s*", " ", place)
    return _strip_decoration(place)[:MAX_FIELD].strip()


def parse_post(raw: dict, month: str) -> Post:
    """Build a Post from one stored top-level comment."""
    text, hrefs = textutil.html_to_text(raw["text"])
    header = textutil.first_line(text)
    post = Post(
        id=int(raw["id"]),
        month=month,
        author=raw.get("author") or "",
        created_at=int(raw.get("created_at") or 0),
        text=text,
        links=textutil.find_urls(text, hrefs),
        header=header,
        header_links=textutil.find_urls(header[:MAX_HEADER]),
    )
    segments = split_header(header)
    structured = len(segments) >= 2
    name: str | None = None
    aliases: list[str] = []
    yc: str | None = None
    found: list[str] = []
    rest: list[str] = []
    if not structured:
        name = name_from_sentence(header)
    if name is None and segments:
        name, aliases, yc, found, leftover = clean_company(segments[0], structured)
        rest = ([leftover] if leftover else []) + segments[1:]
        if name is None:
            # Second look with the post's own links as evidence: "Remote" is a
            # company when the post links to remote.com, and in
            # "REMOTE | CTO | Acme" the segment matching a link is the company.
            labels = frozenset(linkinfo.link_labels(post.links))
            if labels:
                name, aliases, yc, found, leftover = clean_company(segments[0], structured, labels)
                rest = ([leftover] if leftover else []) + segments[1:]
            for index, segment in enumerate(segments[1:] if labels and name is None else [], 1):
                candidate = _strip_decoration(_PAREN_RE.sub(" ", segment))
                if (
                    candidate
                    and len(candidate.split()) <= 4
                    and not textutil.find_urls(candidate)
                    and any(linkinfo.name_matches_label(candidate, label) for label in labels)
                ):
                    name, rest = candidate, segments[:index] + segments[index + 1 :]
                    break
    if name is not None and not structured and len(text) < 150:
        name = None  # a one-line comment, not a job post
    post.company, post.aliases, post.yc = name, aliases, yc
    post.header_links = _dedupe([*post.header_links, *found], 10)

    roles: list[str] = []
    places: list[str] = []
    policies: list[str] = []
    for segment in rest:
        if textutil.find_urls(segment) and len(segment.split()) == 1:
            continue
        for domain in textutil.find_bare_domains(segment):
            if domain not in post.header_links:
                post.header_links.append(domain)
        post.employment.extend(m.group(1).lower() for m in _EMPLOYMENT_RE.finditer(segment))
        if post.salary is None:
            post.salary = find_salary(segment)
            if post.salary and not looks_like_role(_SALARY_RE.sub(" ", segment)):
                continue
        if _is_only(_EMPLOYMENT_RE, segment) or _is_only(_VISA_RE, segment):
            continue
        policy = remote_policy(segment)
        if policy and (post.remote is None or policy == "hybrid"):
            post.remote = policy
        if looks_like_place(segment) and not _STRONG_TITLE_RE.search(segment):
            places.append(_tidy_place(segment))
        elif policy and not _TITLE_RE.search(segment):
            policies.append(_tidy_place(segment))
        elif looks_like_role(segment):
            roles.extend(split_roles(segment))

    if post.company is None:
        return post
    if not roles:
        roles = body_roles(text.split("\n")[1:])
    post.roles = _dedupe(roles, MAX_ROLES)
    post.employment = _dedupe(post.employment, 4)
    location = next((p for p in [*places, *policies] if p), None)
    post.location = location
    if post.remote is None:
        post.remote = remote_policy(header[:MAX_HEADER])
    if post.salary is None:
        post.salary = find_salary(text)
    return post


def parse_thread(thread: dict) -> list[Post]:
    return [parse_post(raw, thread["month"]) for raw in thread["posts"]]
