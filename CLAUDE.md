# Still Hiring? — notes for working on this repository

A standard-library Python pipeline (`stillhiring/`) turns HN "Who is hiring?" threads into
JSON for a static site (`site/`, no build step, no dependencies).

## Commands

- `python -m stillhiring fetch | build | stats | serve`
- `ruff check . && ruff format --check . && pytest`
- `node --test "tests/js/*.mjs"`

## Rules

1. **Neutral wording.** The site reports counts: threads in a row, share of unchanged
   words. Never label a company or a posting ("ghost job", "fake", "evergreen", "stale").
   Absence from a thread is "did not post", not "stopped hiring".
2. **Never publish post text or authors.** Output may carry post ids, counts, similarity
   and the short header fields (roles, location, pay). `tests/test_build.py` checks this;
   keep that test passing rather than loosening it.
3. **`data/` is never committed.** It holds the full text of every post.
4. **Parser bugs get a case first.** Add the offending header to
   `tests/cases/headers.json`, watch it fail, then fix `stillhiring/parse.py`.
   Use invented company names in tests.
5. **When in doubt, do not merge companies.** A false merge invents a run for a real
   company. Prefer leaving two entries and listing the case in `stats`; settle individual
   cases in `overrides.json`, not with a special case in code.
6. **Python and JS twins change together.** `site/diff.js` mirrors
   `stillhiring/similarity.py` and `textutil.tokens`; `site/shard.js` mirrors
   `build.shard_of`. Both sides read `tests/cases/similarity.json` and `shards.json`.
7. **Everything from HN or the data files goes into the page as text**, with
   `textContent` or text nodes. No `innerHTML`.
8. **The site must work on a phone.** Tap targets are at least 44px, text at least 13px,
   no horizontal scroll at 320px, and nothing is available on hover only.
   The first company must be visible without scrolling on a 390×844 screen, and nothing
   may move under a finger between touch and release (a shifted row turns a touch on a
   strip into a tap on the row).
9. **Be polite to the API.** Requests are sequential and rate-limited; closed threads are
   fetched once. Do not add parallel fetching.

## Checking a change to the rules

After touching `parse.py`, `links.py` or `identity.py`, run `python -m stillhiring stats`
on live data and compare with the previous output: company count, parser coverage, and
the three lists at the end. Known reference points: Better Stack has a long same-text
run; the two unrelated Krakens (kraken.com, kraken.io) are separate companies; Ai2 and
"Allen Institute for AI" are one.
