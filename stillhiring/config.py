"""Settings for the pipeline. Everything here is meant to be edited."""

from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "raw"
SITE_DIR = ROOT / "site"
SITE_DATA_DIR = SITE_DIR / "data"
OVERRIDES_PATH = ROOT / "overrides.json"

# --- HN API ---------------------------------------------------------------

ALGOLIA_API = "https://hn.algolia.com/api/v1"

# Put a way to reach you here before running this on a schedule, e.g.
# "https://github.com/you/still-hiring". It is sent with every API request so
# the operators can contact you instead of blocking the client.
CONTACT_URL = os.environ.get("STILL_HIRING_CONTACT", "")
USER_AGENT = f"still-hiring/0.1 (+{CONTACT_URL})" if CONTACT_URL else "still-hiring/0.1"

START_MONTH = "2019-01"  # first thread to track, YYYY-MM
REQUEST_DELAY = 1.0  # seconds between API requests
REQUEST_TIMEOUT = 90
REQUEST_RETRIES = 4

# A thread older than this when it was fetched is treated as final and is not
# downloaded again. HN closes threads to new comments after about two weeks.
SETTLE_DAYS = 45

# --- Metrics --------------------------------------------------------------

STRIP_LEN = 24  # threads shown in the strip on each row
SAME_TEXT = 0.90  # similarity at or above this counts as "nearly the same text"
LONG_RUN = 6  # threads in a row for the "same text, 6+ in a row" filter
STOPPED_MIN_RUN = 4  # run length for the "stopped after 4+ in a row" filter

# For this many days the newest thread is still filling up: a company that has
# not posted in it yet keeps its run.
OPEN_DAYS = 7

# --- Company matching -----------------------------------------------------

# A link or domain used under this many unrelated names, with no single name
# holding SHARED_KEY_TOP_SHARE of the posts, is a shared board (a fund's
# portfolio page, an agency) and is not used to merge companies.
SHARED_KEY_MIN_NAMES = 4
SHARED_KEY_TOP_SHARE = 0.6

# Two same-named groups with different domains are merged only when their
# posts are at least this similar, or when the same HN account wrote both.
NAME_MERGE_MIN_SIMILARITY = 0.5

# Applicant tracking systems. Each rule is (provider, host regex, where the
# company slug lives): "path" = first path segment, "path:<prefix>" = segment
# after <prefix>, "sub" = first group of the host regex, "query:<name>".
ATS_RULES: list[tuple[str, str, str]] = [
    ("greenhouse", r"(?:job-)?boards(?:\.eu)?\.greenhouse\.io", "query:for"),
    ("greenhouse", r"(?:job-)?boards(?:\.eu)?\.greenhouse\.io", "path"),
    ("lever", r"jobs(?:\.eu)?\.lever\.co", "path"),
    ("ashby", r"jobs\.ashbyhq\.com", "path"),
    ("workable", r"apply\.workable\.com", "path"),
    ("workable", r"([a-z0-9-]+)\.workable\.com", "sub"),
    ("bamboohr", r"([a-z0-9-]+)\.bamboohr\.com", "sub"),
    ("breezy", r"([a-z0-9-]+)\.breezy\.hr", "sub"),
    ("recruitee", r"([a-z0-9-]+)\.recruitee\.com", "sub"),
    ("personio", r"([a-z0-9-]+)\.jobs\.personio\.(?:de|com)", "sub"),
    ("applytojob", r"([a-z0-9-]+)\.applytojob\.com", "sub"),
    ("teamtailor", r"([a-z0-9-]+)\.teamtailor\.com", "sub"),
    ("smartrecruiters", r"(?:jobs|careers)\.smartrecruiters\.com", "path"),
    ("jobvite", r"jobs\.jobvite\.com", "path"),
    ("workday", r"([a-z0-9-]+)\.wd\d+\.myworkdayjobs\.com", "sub"),
    ("pinpoint", r"([a-z0-9-]+)\.pinpointhq\.com", "sub"),
    ("rippling", r"ats\.rippling\.com", "path"),
    ("gem", r"jobs\.gem\.com", "path"),
    ("polymer", r"jobs\.polymer\.co", "path"),
    ("wellfound", r"(?:wellfound\.com|angel\.co)", "path:company"),
    ("yc", r"ycombinator\.com", "path:companies"),
    ("yc", r"workatastartup\.com", "path:companies"),
    ("linkedin", r"(?:[a-z]{2}\.)?linkedin\.com", "path:company"),
    ("recruiterbox", r"([a-z0-9-]+)\.recruiterbox\.com", "sub"),
    ("freshteam", r"([a-z0-9-]+)\.freshteam\.com", "sub"),
    ("bamboohr", r"([a-z0-9-]+)\.bamboohr\.co\.uk", "sub"),
    ("rippling", r"([a-z0-9-]+)\.rippling-ats\.com", "sub"),
    ("applicantpro", r"([a-z0-9-]+)\.applicantpro\.com", "sub"),
    ("taleo", r"([a-z0-9-]+)\.taleo\.net", "sub"),
    ("welcomekit", r"([a-z0-9-]+)\.welcomekit\.co", "sub"),
    ("wttj", r"welcometothejungle\.com", "path:companies"),
    ("join", r"join\.com", "path:companies"),
    ("dover", r"app\.dover\.(?:com|io)", "path:apply"),
    ("gusto", r"jobs\.gusto\.com", "path:boards"),
    ("jobscore", r"careers\.jobscore\.com", "path:careers"),
    ("trinet", r"app\.trinethire\.com", "path:companies"),
]

# Slugs that belong to the ATS product itself rather than to a customer.
ATS_RESERVED_SLUGS = frozenset(
    "www app apply jobs careers api help support docs blog status embed job-boards boards "
    "company companies login signup about j o job en fr de recruiting careersite".split()
)

# Hosts that never identify a company: link shorteners, social networks,
# form builders, news sites, app stores, job aggregators.
GENERIC_HOSTS = frozenset(
    """
    bit.ly grnh.se smrtr.io t.co tinyurl.com lnkd.in goo.gl ow.ly buff.ly rebrand.ly tiny.cc
    is.gd cutt.ly shorturl.at
    linkedin.com twitter.com x.com facebook.com instagram.com youtube.com youtu.be vimeo.com
    medium.com substack.com reddit.com threads.net bsky.app mastodon.social tiktok.com
    github.com gitlab.com bitbucket.org gist.github.com github.io
    google.com docs.google.com forms.gle drive.google.com goo.gle notion.so notion.site
    airtable.com typeform.com tally.so calendly.com cal.com jotform.com loom.com figma.com
    zoom.us discord.gg discord.com slack.com t.me telegram.me whatsapp.com wa.me
    ycombinator.com news.ycombinator.com workatastartup.com wellfound.com angel.co
    keyvalues.com otta.com glassdoor.com indeed.com stackoverflow.com levels.fyi
    remoteok.com remoteok.io weworkremotely.com hired.com triplebyte.com crunchbase.com
    techcrunch.com wikipedia.org en.wikipedia.org nytimes.com wsj.com forbes.com bloomberg.com
    wired.com theverge.com venturebeat.com businessinsider.com reuters.com arstechnica.com
    apps.apple.com itunes.apple.com play.google.com chrome.google.com
    greenhouse.io lever.co ashbyhq.com workable.com bamboohr.com breezy.hr recruitee.com
    personio.de personio.com applytojob.com teamtailor.com smartrecruiters.com jobvite.com
    myworkdayjobs.com pinpointhq.com rippling.com gem.com polymer.co icims.com
    recruiterbox.com freshteam.com bamboohr.co.uk rippling-ats.com applicantpro.com taleo.net
    welcomekit.co welcometothejungle.com join.com dover.com dover.io gusto.com jobscore.com
    trinethire.com paylocity.com ziprecruiter.com indeedjobs.com myworkdaysite.com
    oraclecloud.com paycomonline.net recruiterflow.com wrkhq.com thehub.io devitjobs.uk
    djinni.co withgoogle.com startup.jobs
    amazon.com aws.amazon.com archive.org web.archive.org
    """.split()
)

# Free mail providers: an address there says nothing about the employer.
FREEMAIL_DOMAINS = frozenset(
    """
    gmail.com googlemail.com outlook.com hotmail.com live.com yahoo.com icloud.com me.com
    proton.me protonmail.com pm.me fastmail.com hey.com aol.com gmx.com gmx.de mail.com
    yandex.com yandex.ru zoho.com
    """.split()
)

# Second-level suffixes under which anyone can register a name. Not the full
# Public Suffix List, just what shows up in practice.
MULTI_PART_SUFFIXES = frozenset(
    """
    co.uk org.uk ac.uk gov.uk me.uk com.au net.au org.au edu.au co.nz org.nz co.jp ne.jp
    or.jp com.br com.mx com.ar com.co com.tr com.sg com.hk com.cn com.tw co.in co.za co.il
    co.kr com.ua com.pl com.ng com.my com.ph co.id co.th com.vn
    github.io gitlab.io vercel.app netlify.app herokuapp.com web.app pages.dev fly.dev
    webflow.io carrd.co wixsite.com wordpress.com blogspot.com substack.com
    """.split()
)

# Top-level domains recognised when a company writes its name as a bare
# domain ("Acme.io") or drops a bare domain into the header.
BARE_DOMAIN_TLDS = frozenset(
    """
    com io ai co dev app org net so xyz tech sh gg fm tv ly me us in de fr uk eu ca nl se ch
    es it au jp bio health finance cloud software systems tools works studio earth
    """.split()
)

# Things that look like domains in a job post but are technologies.
NOT_DOMAINS = frozenset(
    """
    asp.net ado.net vb.net ml.net node.js vue.js next.js nuxt.js three.js d3.js
    socket.io draw.io ember.js react.js express.js nest.js backbone.js angular.js
    """.split()
)

# Names that are not a company. Posts using them are matched by link only.
GENERIC_NAMES = frozenset(
    """
    stealth stealthstartup stealthmode stealthmodestartup stealthco stealthcompany
    confidential undisclosed anonymous startup earlystagestartup seedstagestartup
    mycompany ourcompany company hiring remote onsite hybrid various multiple unknown tbd na
    fulltime parttime contract internship
    """.split()
)

# Trailing words dropped when comparing company names.
LEGAL_SUFFIXES = frozenset(
    """
    inc incorporated llc ltd limited gmbh corp corporation co company plc sa sas srl bv ab ag
    oy as aps pty pte nv kk
    """.split()
)
