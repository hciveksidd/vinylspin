"""Decide which posts come from the same company.

Evidence, strongest first:

1. a link to the company's ATS board (jobs.lever.co/acme) or its own domain;
2. the company name as written in the header;
3. the HN account that wrote the post.

A wrong merge invents a long run of posts for a real company, a missed merge
only shortens one. So when the evidence disagrees the posts stay apart and the
case is listed by `python -m stillhiring stats` for a human to settle in
overrides.json.
"""

from __future__ import annotations

import json
import re
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from pathlib import Path

from . import config, links, similarity, textutil
from .parse import Post

_NAME_AS_DOMAIN_RE = re.compile(r"([a-z0-9-]+)\.([a-z]{2,})")


# --- Names ----------------------------------------------------------------


def name_tokens(name: str) -> list[str]:
    """Words of a company name: no case, accents, punctuation or legal suffix."""
    text = unicodedata.normalize("NFKD", name)
    text = "".join(char for char in text if not unicodedata.combining(char)).lower().strip()
    as_domain = _NAME_AS_DOMAIN_RE.fullmatch(text)
    if (
        as_domain
        and as_domain.group(2) in config.BARE_DOMAIN_TLDS
        and text not in config.NOT_DOMAINS
    ):
        text = as_domain.group(1)  # "Kraken.io" is named "kraken"; the domain is evidence
    text = re.sub(r"['’`]", "", text.replace("&", " and "))
    tokens = re.findall(r"[a-z0-9]+", text)
    if len(tokens) > 1 and tokens[0] == "the":
        tokens = tokens[1:]
    while len(tokens) > 1 and tokens[-1] in config.LEGAL_SUFFIXES:
        tokens.pop()
    return tokens


def name_key(name: str | None) -> str | None:
    """'The Acme Co., Inc.' -> 'acme'; None for missing or generic names."""
    if not name:
        return None
    key = "".join(name_tokens(name))
    if len(key) < 2 or key in config.GENERIC_NAMES:
        return None
    return key


def slugify(name: str) -> str:
    """'Beautiful.ai' -> 'beautiful-ai', 'Apple, Inc.' -> 'apple'."""
    return "-".join(name_tokens(name.replace(".", " "))) or "company"


# --- Evidence -------------------------------------------------------------


@dataclass(frozen=True)
class Evidence:
    name: str | None  # normalised name written in the header
    family: str | None  # its first word: "apple" for "Apple Maps"
    aliases: tuple[str, ...]  # other names the post gives for itself
    strong: tuple[str, ...]  # "ats:lever:acme", "dom:acme.com"
    derived: str | None  # for posts without a name: one guessed from their link
    linked: tuple[str, ...]  # every non-generic domain linked anywhere in the post


def evidence(post: Post) -> Evidence:
    tokens = name_tokens(post.company) if post.company else []
    key = name_key(post.company)
    header = set(post.header_links)
    mail = {
        domain for domain in map(links.own_domain, textutil.find_email_domains(post.text)) if domain
    }
    strong: dict[str, None] = {}
    linked: dict[str, None] = {}
    slugs: list[str] = []
    for url in [*post.header_links, *post.links]:
        ats = links.ats_key(url)
        if ats:
            strong.setdefault(f"ats:{ats[0]}:{ats[1]}")
            slugs.append(links.letters(ats[1]))
            continue
        domain = links.own_domain(url)
        if not domain:
            continue
        linked.setdefault(domain)
        if (
            url in header
            or domain in mail
            or links.is_careers_link(url)
            or (post.company and links.name_matches_label(post.company, links.domain_label(domain)))
        ):
            strong.setdefault(f"dom:{domain}")
            slugs.append(links.domain_label(domain))
    for domain in mail:
        linked.setdefault(domain)
        strong.setdefault(f"dom:{domain}")
        slugs.append(links.domain_label(domain))
    derived = None
    if key is None and slugs and slugs[0] not in config.GENERIC_NAMES and len(slugs[0]) >= 2:
        derived = slugs[0]
    return Evidence(
        name=key,
        family=tokens[0] if key and tokens else None,
        aliases=tuple(alias for alias in map(name_key, post.aliases) if alias and alias != key),
        strong=tuple(strong),
        derived=derived,
        linked=tuple(linked),
    )


# --- Overrides ------------------------------------------------------------


@dataclass
class Overrides:
    merge: list[list[str]] = field(default_factory=list)
    separate: list[list[str]] = field(default_factory=list)
    ignore_keys: set[str] = field(default_factory=set)
    rename: dict[str, str] = field(default_factory=dict)

    @classmethod
    def load(cls, path: Path | None) -> Overrides:
        if path is None or not path.exists():
            return cls()
        data = json.loads(path.read_text(encoding="utf-8"))
        return cls(
            merge=[[normalise_key(key) for key in group] for group in data.get("merge", [])],
            separate=[[normalise_key(key) for key in group] for group in data.get("separate", [])],
            ignore_keys={normalise_key(key) for key in data.get("ignore_keys", [])},
            rename={normalise_key(key): value for key, value in data.get("rename", {}).items()},
        )


def normalise_key(key: str) -> str:
    """Accept 'Acme Inc', 'acme.com' or 'ats:lever:acme' and return a full key."""
    key = key.strip()
    if key.startswith(("ats:", "dom:", "name:")):
        prefix, rest = key.split(":", 1)
        return f"{prefix}:{rest.lower()}"
    if re.fullmatch(r"[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}", key.lower()):
        return f"dom:{key.lower()}"
    return f"name:{name_key(key) or key.lower()}"


# --- Clustering -----------------------------------------------------------


@dataclass
class Company:
    id: str
    name: str
    posts: list[Post]
    names: list[tuple[str, int]]  # spellings, most frequent first
    domains: list[str]  # own domains, most frequent first
    keys: frozenset[str]  # every name:, dom: and ats: key of the group


@dataclass
class Clustering:
    companies: list[Company]
    unmatched: list[Post]  # posts with nothing to identify them by
    shared_keys: dict[str, int]  # dropped as shared boards -> number of posts
    conflicts: list[dict]  # same name kept apart: {"name", "groups": [...]}

    def by_post(self) -> dict[int, Company]:
        return {post.id: company for company in self.companies for post in company.posts}


class _Groups:
    """Union-find over post indexes that keeps the member list of each group."""

    def __init__(self, size: int) -> None:
        self.parent = list(range(size))
        self.members: dict[int, list[int]] = {index: [index] for index in range(size)}

    def find(self, index: int) -> int:
        root = index
        while self.parent[root] != root:
            root = self.parent[root]
        while self.parent[index] != root:
            self.parent[index], index = root, self.parent[index]
        return root

    def union(self, a: int, b: int) -> int:
        a, b = self.find(a), self.find(b)
        if a == b:
            return a
        if len(self.members[a]) < len(self.members[b]):
            a, b = b, a
        self.parent[b] = a
        self.members[a].extend(self.members.pop(b))
        return a


def _key_label(key: str) -> str:
    """The part of a key that names its owner: 'acme' for dom:acme.com and ats:lever:acme."""
    value = key.rsplit(":", 1)[1]
    return links.domain_label(value) if key.startswith("dom:") else links.letters(value)


def _usable_keys(
    posts: list[Post], facts: list[Evidence], overrides: Overrides
) -> tuple[list[list[str]], dict[str, int], dict[str, list[int]]]:
    """Per post, the strong keys that may merge it with other posts.

    A link identifies a company only when the posts behind it agree on who
    that is. Posts whose name fits the link ("Acme" and acme.com) are its
    owners, posts under any other name are guests.

    - No owner and several guests: a job board. The key is dropped.
    - Many names and no clear majority: a fund's portfolio board or an agency.
      The key is dropped.
    - An owner and several guests: the owner's clients or sister brands. The
      guests keep their own names and do not use the key.
    - An owner and one guest: a rename or a subsidiary. They merge.
    """
    by_key: dict[str, list[int]] = defaultdict(list)
    for index, fact in enumerate(facts):
        for key in fact.strong:
            by_key[key].append(index)
    shared: dict[str, int] = {}
    barred: dict[int, set[str]] = defaultdict(set)
    for key, members in by_key.items():
        label = _key_label(key)
        named = [i for i in members if facts[i].family]
        fits = {i: links.name_matches_label(posts[i].company or "", label) for i in named}
        owners = sum(fits.values())
        guests = Counter(facts[i].family for i in named if not fits[i])
        families = len(guests) + bool(owners)
        largest = max([owners, *guests.values()], default=0)
        crowded = (
            families >= config.SHARED_KEY_MIN_NAMES
            and largest < config.SHARED_KEY_TOP_SHARE * len(named)
        )
        foreign = not owners and len(guests) >= 2
        if key in overrides.ignore_keys or crowded or foreign:
            shared[key] = len(members)
        elif owners and len(guests) >= 2:
            for i in named:
                if not fits[i]:
                    barred[i].add(key)
    kept = [
        [key for key in fact.strong if key not in shared and key not in barred.get(index, ())]
        for index, fact in enumerate(facts)
    ]
    return kept, shared, by_key


def cluster(
    posts: list[Post],
    overrides: Overrides | None = None,
    tokens: similarity.TokenCache | None = None,
) -> Clustering:
    """Group posts into companies. `posts` must be sorted oldest first."""
    overrides = overrides or Overrides()
    tokens = tokens or similarity.TokenCache()
    facts = [evidence(post) for post in posts]
    groups = _Groups(len(posts))

    # 1. Strong keys, minus the ones that do not identify one company.
    kept, shared, by_strong = _usable_keys(posts, facts, overrides)
    for key, members in by_strong.items():
        usable = [index for index in members if key in kept[index]]
        for index in usable[1:]:
            groups.union(usable[0], index)

    def domains_of(root: int) -> set[str]:
        return {key for i in groups.members[root] for key in kept[i] if key.startswith("dom:")}

    def keys_of(root: int) -> set[str]:
        found = {key for i in groups.members[root] for key in kept[i]}
        found.update(f"name:{facts[i].name}" for i in groups.members[root] if facts[i].name)
        return found

    def authors_of(root: int) -> set[str]:
        return {posts[i].author for i in groups.members[root]}

    def separated(a: int, b: int) -> bool:
        if not overrides.separate:
            return False
        keys_a, keys_b = keys_of(a), keys_of(b)
        for group in overrides.separate:
            held_a, held_b = keys_a & set(group), keys_b & set(group)
            if held_a and held_b and held_a != held_b:
                return True
        return False

    def same_voice(a: int, b: int) -> bool:
        """Do two groups share an author, or read alike?"""
        if authors_of(a) & authors_of(b):
            return True
        small, large = sorted((groups.members[a], groups.members[b]), key=len)
        small, large = sorted(small), sorted(large)
        picks = {small[0], small[len(small) // 2], small[-1]}
        for index in picks:
            nearest = min(large, key=lambda other: abs(other - index))
            score = similarity.ratio(tokens(posts[index]), tokens(posts[nearest]))
            if score >= config.NAME_MERGE_MIN_SIMILARITY:
                return True
        return False

    # 2. Names. A nameless post borrows one from its own link ("derived").
    by_name: dict[str, list[int]] = defaultdict(list)
    for index, fact in enumerate(facts):
        name = fact.name or (fact.derived if kept[index] else None)
        if name:
            by_name[name].append(index)
    conflicts: list[dict] = []
    for name in sorted(by_name):
        roots = sorted(
            {groups.find(i) for i in by_name[name]},
            key=lambda root: (-len(groups.members[root]), min(groups.members[root])),
        )
        if len(roots) < 2:
            continue
        anchored = [root for root in roots if domains_of(root)]
        floating = [root for root in roots if not domains_of(root)]
        # Groups with different domains merge only on further evidence.
        sets: list[list[int]] = []
        for root in anchored:
            for existing in sets:
                if not separated(existing[0], root) and any(
                    same_voice(member, root) for member in existing
                ):
                    existing.append(root)
                    break
            else:
                sets.append([root])
        if len(sets) <= 1:
            target = sets[0] if sets else []
            for root in floating:
                if target and separated(target[0], root):
                    sets.append([root])
                else:
                    target.append(root)
            if target and target not in sets:
                sets.append(target)
        else:
            loose: list[int] = []
            for root in floating:
                home = next(
                    (
                        existing
                        for existing in sets
                        if not separated(existing[0], root)
                        and any(same_voice(member, root) for member in existing)
                    ),
                    None,
                )
                (home if home is not None else loose).append(root)
            if loose:
                sets.append(loose)
        if len(sets) > 1:
            conflicts.append(
                {
                    "name": name,
                    "groups": [
                        {
                            "posts": sum(len(groups.members[root]) for root in members),
                            "domains": sorted(
                                key[4:] for root in members for key in domains_of(root)
                            ),
                        }
                        for members in sets
                    ],
                }
            )
        for members in sets:
            for root in members[1:]:
                groups.union(members[0], root)

    # 3. Other names a post gives for itself: merge only on further evidence.
    for index, fact in enumerate(facts):
        for alias in fact.aliases:
            for other in by_name.get(alias, [])[:1]:
                a, b = groups.find(index), groups.find(other)
                if a != b and not separated(a, b) and same_voice(a, b):
                    groups.union(a, b)

    # 4. Posts with no name and no link of their own: attach by a linked
    #    domain that one company owns, else by an author who only ever
    #    posted for one company.
    def identified(root: int) -> bool:
        return any(facts[i].name or kept[i] for i in groups.members[root])

    owner: dict[str, set[int]] = defaultdict(set)
    for index in range(len(posts)):
        for key in kept[index]:
            if key.startswith("dom:"):
                owner[key[4:]].add(groups.find(index))
    orphans = [i for i in range(len(posts)) if not identified(groups.find(i))]
    for index in orphans:
        homes = {groups.find(root) for d in facts[index].linked for root in owner.get(d, ())}
        if len(homes) == 1:
            groups.union(homes.pop(), index)
    by_author: dict[str, set[int]] = defaultdict(set)
    for index, post in enumerate(posts):
        root = groups.find(index)
        if identified(root):
            by_author[post.author].add(root)
    for index in orphans:
        if identified(groups.find(index)):
            continue
        homes = {groups.find(root) for root in by_author.get(posts[index].author, ())}
        if len(homes) == 1:
            groups.union(homes.pop(), index)

    # 5. Manual merges: every group holding one of the listed keys becomes one.
    holders: dict[str, list[int]] = defaultdict(list)
    for root in list(groups.members):
        for key in keys_of(root):
            holders[key].append(root)
    for group in overrides.merge:
        roots = [root for key in group for root in holders.get(key, [])]
        for root in roots[1:]:
            groups.union(roots[0], root)

    # 6. Companies.
    companies: list[Company] = []
    unmatched: list[Post] = []
    for root, members in groups.members.items():
        members.sort()
        if not identified(root):
            unmatched.extend(posts[i] for i in members)
            continue
        companies.append(_company(root, members, posts, facts, kept, keys_of(root), overrides))
    _assign_ids(companies)
    companies.sort(key=lambda company: company.id)
    unmatched.sort(key=lambda post: post.id)
    return Clustering(companies, unmatched, shared, conflicts)


def _company(
    root: int,
    members: list[int],
    posts: list[Post],
    facts: list[Evidence],
    kept: list[list[str]],
    keys: set[str],
    overrides: Overrides,
) -> Company:
    group = [posts[i] for i in members]
    spellings = Counter(post.company for post in group if post.company and name_key(post.company))
    domains = Counter(key[4:] for i in members for key in kept[i] if key.startswith("dom:"))
    recent_months = sorted({post.month for post in group})[-12:]
    recent = Counter(
        post.company
        for post in group
        if post.company and name_key(post.company) and post.month in recent_months
    )
    latest = {post.company: post.id for post in group if post.company}
    if recent:
        name = max(recent, key=lambda spelling: (recent[spelling], latest[spelling]))
    elif domains:
        name = domains.most_common(1)[0][0]
    else:
        slugs = [key.rsplit(":", 1)[1] for i in members for key in kept[i]]
        name = Counter(slugs).most_common(1)[0][0] if slugs else f"post {group[0].id}"
    for key in sorted(keys):
        if key in overrides.rename:
            name = overrides.rename[key]
            break
    return Company(
        id="",
        name=name,
        posts=group,
        names=spellings.most_common(),
        domains=[domain for domain, _ in domains.most_common()],
        keys=frozenset(keys),
    )


def _assign_ids(companies: list[Company]) -> None:
    """Give each company a readable id that stays the same between builds."""
    taken: set[str] = set()
    for company in sorted(companies, key=lambda c: (-len(c.posts), c.posts[0].id)):
        base = slugify(company.names[0][0] if company.names else company.name)
        candidates = [base]
        if company.domains:
            candidates.append(f"{base}-{slugify(company.domains[0])}")
        candidates.append(f"{base}-{company.posts[0].id}")
        company.id = next(candidate for candidate in candidates if candidate not in taken)
        taken.add(company.id)
