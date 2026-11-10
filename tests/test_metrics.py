from __future__ import annotations

import pytest
from conftest import DAY, NOW, month_start

from stillhiring import build, config, metrics


def threads(count: int, newest_open: bool = False) -> list[metrics.Thread]:
    made = [
        metrics.Thread(index=i, month=f"2026-{i + 1:02d}", id=i, created_at=0, posts=1, open=False)
        for i in range(count)
    ]
    made[-1].open = newest_open
    return made


def runs(present: list[int], scores: dict[int, float] | None = None, **kwargs):
    return metrics.runs(present, scores or {}, threads(6, **kwargs))


def test_run_counts_consecutive_threads_up_to_the_newest() -> None:
    run, same, average, longest, stopped = runs([0, 2, 3, 4, 5])
    assert (run, longest, stopped) == (4, 4, 0)
    assert (same, average) == (1, None)


def test_same_run_counts_back_while_the_text_stays_nearly_the_same() -> None:
    scores = {1: 0.99, 2: 0.4, 3: 0.95, 4: 0.91, 5: 1.0}
    run, same, average, _, _ = runs([0, 1, 2, 3, 4, 5], scores)
    assert run == 6
    assert same == 4  # threads 2..5: the rewrite in thread 2 starts a new chain
    assert average == pytest.approx((0.95 + 0.91 + 1.0) / 3)


def test_same_run_uses_the_threshold_from_config() -> None:
    _, at_threshold, _, _, _ = runs([4, 5], {5: config.SAME_TEXT})
    _, below, _, _, _ = runs([4, 5], {5: config.SAME_TEXT - 0.01})
    assert (at_threshold, below) == (2, 1)


def test_a_company_that_missed_the_newest_thread_has_stopped() -> None:
    run, same, _, longest, stopped = runs([0, 1, 2, 3])
    assert (run, same, longest, stopped) == (0, 0, 4, 4)


def test_longest_run_can_be_an_older_one() -> None:
    run, _, _, longest, _ = runs([0, 1, 2, 4, 5])
    assert (run, longest) == (2, 3)


def test_an_open_newest_thread_does_not_end_a_run() -> None:
    run, same, _, _, stopped = runs([2, 3, 4], {3: 1.0, 4: 1.0}, newest_open=True)
    assert (run, same, stopped) == (3, 3, 0)
    # ...but two missed threads do.
    assert runs([2, 3], newest_open=True)[4] == 2


def test_posting_in_the_open_thread_counts() -> None:
    assert runs([4, 5], newest_open=True)[0] == 2


def test_thread_list_marks_only_a_fresh_newest_thread_as_open(make) -> None:
    raw = [make.thread("2026-10", []), make.thread("2026-11", [])]
    fresh = metrics.thread_list(raw, now=month_start("2026-11") + 3 * DAY)
    settled = metrics.thread_list(raw, now=month_start("2026-11") + (config.OPEN_DAYS + 1) * DAY)
    assert [thread.open for thread in fresh] == [False, True]
    assert [thread.open for thread in settled] == [False, False]


def test_compute_on_the_sample_threads(raw_dir) -> None:
    analysis = build.analyze(raw_dir, start_month="2026-01", overrides_path=None, now=NOW)
    by_name = {company.company.name: company for company in analysis.companies}
    assert set(by_name) == {"Acme Robotics", "Bolt Bakery", "Cedar Analytics"}

    acme = by_name["Acme Robotics"]
    assert (acme.run, acme.longest_run, acme.stopped_after, acme.is_new) == (6, 6, 0, False)
    assert acme.same_run == 3  # rewritten in 2026-09, unchanged since
    assert acme.cells[0].similarity is None
    assert acme.cells[1].similarity == 1.0
    assert 0.1 < acme.cells[3].similarity < config.SAME_TEXT

    bolt = by_name["Bolt Bakery"]
    assert (bolt.run, bolt.same_run, bolt.stopped_after, bolt.longest_run) == (0, 0, 4, 4)

    cedar = by_name["Cedar Analytics"]
    assert (cedar.run, cedar.is_new) == (1, True)
    assert len(analysis.clustering.unmatched) == 1


def test_thread_totals_on_the_sample_threads(raw_dir) -> None:
    analysis = build.analyze(raw_dir, start_month="2026-01", overrides_path=None, now=NOW)
    first, *_, newest = analysis.threads
    assert (first.posts, first.companies, first.repeat) == (2, 2, None)
    assert (newest.posts, newest.companies) == (3, 2)
    assert newest.repeat == 0.5  # Acme was there the month before, Cedar was not
    assert newest.same_text == 0.5
    assert newest.salary == 0.5 and newest.remote == 0.0
    assert analysis.threads[1].remote == 0.5  # Bolt is remote, Acme is onsite
