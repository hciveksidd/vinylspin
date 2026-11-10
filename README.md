# Still Hiring?

How many months in a row has a company posted in Hacker News "Who is hiring?" threads,
and how much does its post change from one month to the next?

Every month the HN account `whoishiring` opens an "Ask HN: Who is hiring?" thread and
companies post their openings as top-level comments. This project reads every thread
since January 2019, groups the posts by company and publishes a static site:

- a list of companies, each with a strip of its last 24 threads shaded by how much of the
  previous post was repeated;
- a page per company with every post by month and a word-level diff between two posts;
- two charts: posts per thread, and the share of companies that also posted the month before.

The site counts posts. It does not say whether a job is open, filled or real.

## Run it

Python 3.11 or newer. The pipeline uses the standard library only.

```bash
python -m stillhiring fetch
```

Downloads the threads into `data/raw/`. The first run takes about two minutes; later runs
only fetch threads that are still open.

```bash
python -m stillhiring build
```

Writes the site's data to `site/data/`.

```bash
python -m stillhiring serve
```

Serves the site at http://127.0.0.1:8000/.

```bash
python -m stillhiring stats
```

Prints parser coverage and the company matches most likely to be wrong.
`python -m stillhiring stats --company acme` shows how one company was put together.

## The numbers

| Number | Meaning |
| --- | --- |
| in a row | Consecutive monthly threads with a post from the company, counting back from the newest. For the first 7 days of a new thread, not having posted in it yet does not end a run. |
| similarity | Share of words a post has in common, in the same order, with the company's previous post. Links count as one word. |
| same text | How many threads of the run, counting back, were at least 90% similar to the month before. |
| stopped | The company posted 4 or more threads in a row and is not in the newest one. |

The thresholds live in `stillhiring/config.py`.

## How posts become companies

Evidence, strongest first (`stillhiring/identity.py`):

1. a link to the company's ATS board (`jobs.lever.co/acme`) or its own domain;
2. the company name on the post's first line;
3. the HN account that wrote the post.

Two rules keep unrelated companies apart:

- A link shared by unrelated names is not used: a fund's portfolio board, a job board, a
  recruiter's e-mail domain.
- Two groups with the same name but different domains stay separate unless the same
  account wrote both or their texts are alike.

A wrong merge invents a long run for a real company, a missed merge only shortens one.
When in doubt the code does not merge.

### Fixing a match by hand

`overrides.json` is applied last. Keys are a name (`"Acme"`), a domain (`"acme.com"`) or
a full key as printed by `stats --company` (`"ats:lever:acme"`).

```json
{
  "merge": [["Acme", "acme.io", "Acme Robotics"]],
  "separate": [["acme.com", "acme.io"]],
  "ignore_keys": ["ats:ashby:somefund"],
  "rename": { "Acme": "Acme Robotics" }
}
```

- `merge`: every group holding one of the keys becomes one company.
- `separate`: groups holding different keys from the list are never merged by name.
- `ignore_keys`: the link is not used to match anything.
- `rename`: the display name of the company holding the key.

## What is published

`site/data/` holds post ids, counts, similarity scores and the short facts from a post's
first line (roles, location, pay). It never holds the text of a post or the name of the
account that wrote it. When a visitor opens a diff, their browser fetches the two posts
from HN.

`data/raw/` holds full post text. It is ignored by git and must stay that way.

## Tests

```bash
pip install pytest ruff
```

```bash
ruff check . && pytest
```

```bash
node --test "tests/js/*.mjs"
```

`site/diff.js` and `site/shard.js` mirror `stillhiring/similarity.py` and
`build.shard_of`. Both sides are tested against the same files in `tests/cases/`.

## Publishing

`.github/workflows/pages.yml` rebuilds the data every day and deploys `site/` to GitHub
Pages. Before the first run:

1. Enable Pages: Settings → Pages → Source: GitHub Actions.
2. Set `<meta name="repository">` in `site/index.html` to the repository URL. This turns
   on the "source" and "open an issue" links.
3. Optional: add a repository variable `STILL_HIRING_CONTACT` with a URL where the HN API
   operators can reach you. It is sent in the User-Agent of every request.

Scheduled workflows run from the default branch only.

The PNG icons in `site/` are renders of `site/icon.svg`, and `site/og.png` (the link preview,
1200×630) is a render of `site/og.svg`. The preview tags in `site/index.html` hold the site's
absolute address; change them if the site moves.

## Data source

Hacker News, through the [HN Search API](https://hn.algolia.com/api). Not affiliated with
Hacker News or Y Combinator.
