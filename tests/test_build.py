from __future__ import annotations

import json
from pathlib import Path

import pytest
from conftest import ACME, BOLT, DAY, NOW, month_start

from stillhiring import build, cli, config, hn, metrics


def read(directory: Path, name: str):
    return json.loads((directory / name).read_text(encoding="utf-8"))


@pytest.fixture
def site(raw_dir: Path, tmp_path: Path) -> Path:
    out = tmp_path / "data"
    summary = build.build(raw_dir, out, start_month="2026-01", overrides_path=None, now=NOW)
    assert summary == {"threads": 6, "posts": 12, "companies": 3}
    return out


def test_meta_lists_threads_and_thresholds(site: Path) -> None:
    meta = read(site, "meta.json")
    assert meta["built_at"] == "2026-11-20T12:00:00Z"
    assert [thread["m"] for thread in meta["threads"]] == [f"2026-{m:02d}" for m in range(6, 12)]
    assert meta["threads"][-1]["id"] == 202611 and meta["threads"][-1]["open"] is False
    assert meta["thresholds"]["same_text"] == config.SAME_TEXT
    assert meta["totals"] == {"threads": 6, "posts": 12, "matched_posts": 11, "companies": 3}
    assert meta["columns"] == build.COLUMNS


def test_company_rows_follow_the_declared_columns(site: Path) -> None:
    rows = [
        dict(zip(build.COLUMNS, row, strict=True)) for row in read(site, "companies.json")["rows"]
    ]
    assert [row["name"] for row in rows] == ["Acme Robotics", "Cedar Analytics", "Bolt Bakery"]
    acme, cedar, bolt = rows
    assert (acme["first"], acme["last"], acme["threads"]) == (0, 5, 6)
    assert (acme["run"], acme["same"], acme["longest"], acme["stopped"]) == (6, 3, 6, 0)
    assert (acme["sim"], acme["avg"]) == (100, 100)
    assert (
        acme["strip"][:18] == "." * 18
        and acme["strip"][18:21] == "+99"
        and acme["strip"][22:] == "99"
    )
    assert acme["strip"][21] in "1234567"  # the rewrite
    assert bolt["strip"] == "." * 18 + "+999.."
    assert (bolt["run"], bolt["stopped"]) == (0, 4)
    assert cedar["strip"] == "." * 23 + "+" and cedar["sim"] is None


def test_company_history_is_in_the_shard_named_by_its_id(site: Path) -> None:
    detail = read(site, f"c/{build.shard_of('acme-robotics')}.json")["acme-robotics"]
    assert detail["n"] == "Acme Robotics"
    assert detail["names"] == [["Acme Robotics", 6]]
    index, post_ids, similarity, roles, location, remote, salary = detail["t"][0]
    assert (index, similarity) == (0, None)
    assert len(post_ids) == 1 and isinstance(post_ids[0], int)
    assert roles == ["Senior Backend Engineer", "Staff SRE"]
    assert (location, remote, salary) == ("Berlin, Germany", "onsite", "€90k-€120k")
    assert detail["t"][3][3] == ["Data Engineer"]


def test_no_post_text_or_author_is_published(site: Path) -> None:
    published = "".join(path.read_text(encoding="utf-8") for path in site.rglob("*.json"))
    for sentence in ("warehouse robots", "neighbourhood bakeries", "satellite images", "drones"):
        assert sentence not in published
    for author in ("acme_hr", "bolt_founder", "cedar_cto"):
        assert author not in published
    assert "Thanks for the thread" not in published
    longest = max(len(piece) for piece in published.replace("[", '"').split('"'))
    assert longest <= 2 * 80  # nothing longer than a header field


def test_rebuilding_removes_shards_of_companies_that_are_gone(
    raw_dir: Path, tmp_path: Path
) -> None:
    out = tmp_path / "data"
    stale = out / "c" / "zz.json"
    stale.parent.mkdir(parents=True)
    stale.write_text("{}")
    build.build(raw_dir, out, start_month="2026-01", overrides_path=None, now=NOW)
    assert not stale.exists()


def test_build_refuses_a_missing_month(raw_dir: Path, tmp_path: Path) -> None:
    hn.raw_path(raw_dir, "2026-08").unlink()
    with pytest.raises(build.BuildError, match="2026-07 and 2026-09"):
        build.build(raw_dir, tmp_path / "data", start_month="2026-01", overrides_path=None, now=NOW)
    build.build(
        raw_dir,
        tmp_path / "data",
        start_month="2026-01",
        overrides_path=None,
        now=NOW,
        allow_gaps=True,
    )


def test_build_refuses_stale_data(raw_dir: Path, tmp_path: Path) -> None:
    later = month_start("2027-02")
    with pytest.raises(build.BuildError, match="newest thread is 2026-11"):
        build.build(raw_dir, tmp_path / "d", start_month="2026-01", overrides_path=None, now=later)
    # On the first days of a month the new thread may not be up yet: last month's data is fine.
    early = month_start("2026-12") - DAY
    build.build(raw_dir, tmp_path / "d", start_month="2026-01", overrides_path=None, now=early)


def test_build_refuses_an_empty_newest_thread(raw_dir: Path, tmp_path: Path, make) -> None:
    hn.save_raw(hn.raw_path(raw_dir, "2026-12"), make.thread("2026-12", []))
    with pytest.raises(build.BuildError, match="no posts"):
        build.build(raw_dir, tmp_path / "d", start_month="2026-01", overrides_path=None, now=NOW)


def test_build_without_raw_data_explains_what_to_run(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError, match="stillhiring fetch"):
        build.build(tmp_path / "missing", tmp_path / "d", now=NOW)


def test_an_open_newest_thread_keeps_runs_alive(tmp_path: Path, make) -> None:
    raw = tmp_path / "raw"
    for month, texts in {
        "2026-09": [ACME, BOLT],
        "2026-10": [ACME, BOLT],
        "2026-11": [ACME],
    }.items():
        hn.save_raw(hn.raw_path(raw, month), make.thread(month, [make.raw(text) for text in texts]))
    out = tmp_path / "data"
    build.build(
        raw, out, start_month="2026-01", overrides_path=None, now=month_start("2026-11") + DAY
    )
    rows = {
        row[1]: dict(zip(build.COLUMNS, row, strict=True))
        for row in read(out, "companies.json")["rows"]
    }
    assert read(out, "meta.json")["threads"][-1]["open"] is True
    assert rows["Bolt Bakery"]["run"] == 2 and rows["Bolt Bakery"]["stopped"] == 0
    assert rows["Acme Robotics"]["run"] == 3


def test_strip_marks_absence_first_post_and_similarity_in_tenths() -> None:
    company = metrics.CompanyMetrics(
        company=None,
        cells=[
            metrics.Cell(index=1, posts=[]),  # first post ever
            metrics.Cell(index=2, posts=[], similarity=1.0),
            metrics.Cell(index=4, posts=[], similarity=0.57),
            metrics.Cell(index=5, posts=[], similarity=0.0),
        ],
    )
    assert build.strip(company, total=6, length=6) == ".+9.50"
    assert build.strip(company, total=6, length=4) == "9.50"
    assert build.strip(company, total=6, length=8) == "...+9.50"


def test_shard_of_matches_the_shared_cases() -> None:
    """site/shard.js is checked against the same file by tests/js/shard_test.mjs."""
    cases = json.loads(
        (Path(__file__).parent / "cases" / "shards.json").read_text(encoding="utf-8")
    )
    assert cases
    for case in cases:
        assert build.shard_of(case["id"]) == case["shard"]


def test_cli_build_and_stats(raw_dir: Path, tmp_path: Path, capsys, monkeypatch) -> None:
    monkeypatch.setattr("time.time", lambda: NOW)
    out = tmp_path / "data"
    assert cli.main(["build", "--raw", str(raw_dir), "--out", str(out), "--since", "2026-01"]) == 0
    assert "6 threads, 12 posts, 3 companies" in capsys.readouterr().out
    assert cli.main(["stats", "--raw", str(raw_dir), "--since", "2026-01"]) == 0
    report = capsys.readouterr().out
    assert "Threads    6  (2026-06 to 2026-11)" in report
    assert "stopped after 4+ in a row   1" in report
    assert (
        cli.main(["stats", "--raw", str(raw_dir), "--since", "2026-01", "--company", "bolt"]) == 0
    )
    assert "bolt-bakery: Bolt Bakery" in capsys.readouterr().out


def test_cli_reports_missing_data_without_a_traceback(tmp_path: Path, capsys) -> None:
    assert cli.main(["build", "--raw", str(tmp_path / "none"), "--out", str(tmp_path / "o")]) == 1
    assert "error:" in capsys.readouterr().err
