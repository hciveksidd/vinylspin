from __future__ import annotations

import pytest

from stillhiring import links


@pytest.mark.parametrize(
    ("url", "expected"),
    [
        ("https://jobs.lever.co/acme/1f3c", ("lever", "acme")),
        ("https://jobs.eu.lever.co/Acme", ("lever", "acme")),
        ("https://boards.greenhouse.io/acme/jobs/42", ("greenhouse", "acme")),
        ("https://job-boards.greenhouse.io/acme", ("greenhouse", "acme")),
        ("https://boards.greenhouse.io/embed/job_board?for=acme", ("greenhouse", "acme")),
        ("https://jobs.ashbyhq.com/acme/uuid", ("ashby", "acme")),
        ("https://apply.workable.com/acme/j/ABC123/", ("workable", "acme")),
        ("https://apply.workable.com/j/ABC123/", None),
        ("https://acme.bamboohr.com/jobs/", ("bamboohr", "acme")),
        ("https://acme.breezy.hr/p/abc", ("breezy", "acme")),
        ("https://acme.jobs.personio.de/job/1", ("personio", "acme")),
        ("https://acme.wd5.myworkdayjobs.com/en-US/careers", ("workday", "acme")),
        ("https://www.ycombinator.com/companies/acme/jobs/x", ("yc", "acme")),
        ("https://wellfound.com/company/acme/jobs", ("wellfound", "acme")),
        ("https://www.linkedin.com/company/acme-robotics/", ("linkedin", "acme-robotics")),
        ("https://www.welcometothejungle.com/en/companies/acme/jobs", ("wttj", "acme")),
        ("https://acme.example/careers", None),
        ("https://www.linkedin.com/in/someone", None),
        ("https://jobs.lever.co/", None),
    ],
)
def test_ats_key(url: str, expected: tuple[str, str] | None) -> None:
    assert links.ats_key(url) == expected


@pytest.mark.parametrize(
    ("host", "expected"),
    [
        ("acme.com", "acme.com"),
        ("jobs.eu.acme.com", "acme.com"),
        ("jobs.acme.co.uk", "acme.co.uk"),
        ("acme.github.io", "acme.github.io"),
        ("localhost", None),
        ("192.168.0.1", None),
        ("source.inc)|", None),
    ],
)
def test_registrable_domain(host: str, expected: str | None) -> None:
    assert links.registrable_domain(host) == expected


def test_host_of_accepts_bare_domains_and_strips_www() -> None:
    assert links.host_of("https://www.Acme.com:443/jobs") == "acme.com"
    assert links.host_of("acme.io") == "acme.io"


def test_own_domain_skips_ats_and_generic_hosts() -> None:
    assert links.own_domain("https://careers.acme.example/open") == "acme.example"
    assert links.own_domain("https://jobs.lever.co/acme") is None
    assert links.own_domain("https://bit.ly/3abc") is None
    assert links.own_domain("https://www.linkedin.com/in/someone") is None
    assert links.own_domain("https://docs.google.com/forms/x") is None


def test_malformed_addresses_do_not_raise() -> None:
    assert links.host_of("https://[not-ipv6/jobs") == ""
    assert links.ats_key("https://[not-ipv6/jobs") is None
    assert links.own_domain("https://[not-ipv6/jobs") is None


def test_is_careers_link() -> None:
    assert links.is_careers_link("https://acme.example/careers/42")
    assert links.is_careers_link("https://jobs.acme.example")
    assert not links.is_careers_link("https://acme.example/blog/our-series-a")


@pytest.mark.parametrize(
    ("name", "label", "expected"),
    [
        ("Acme", "acme", True),
        ("Acme Labs", "acme", True),
        ("Acme Labs", "getacme", True),
        ("Acme", "acmehq", True),
        ("Apple Maps", "apple", True),
        ("Allen Institute for AI", "allenai", True),
        ("The Allen Institute for Artificial Intelligence", "allenai", True),
        ("International Business Machines", "ibm", True),
        ("Ai2", "allenai", False),
        ("Graphcore", "stealthmode", False),
        ("Conduit Tech", "pear", False),
        ("Jane", "iheartjane", False),
        ("MemSQL", "singlestore", False),
    ],
)
def test_name_matches_label(name: str, label: str, expected: bool) -> None:
    assert links.name_matches_label(name, label) is expected


def test_link_labels_collects_domain_labels_and_ats_slugs() -> None:
    labels = links.link_labels(
        ["https://jobs.lever.co/acme-robotics/1", "https://www.acme.example/x", "https://bit.ly/q"]
    )
    assert labels == {"acmerobotics", "acme"}
