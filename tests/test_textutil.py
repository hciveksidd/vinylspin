from __future__ import annotations

from stillhiring import textutil


def test_html_to_text_separates_paragraphs_and_decodes_entities() -> None:
    text, links = textutil.html_to_text(
        "Acme &amp; Sons | R&amp;D<p>Second&#x2F;paragraph<p><i>Third</i>"
    )
    assert text == "Acme & Sons | R&D\n\nSecond/paragraph\n\nThird"
    assert links == []


def test_html_to_text_keeps_the_full_address_of_a_shortened_link() -> None:
    text, links = textutil.html_to_text(
        'Apply at <a href="https:&#x2F;&#x2F;acme.example&#x2F;jobs&#x2F;42" rel="nofollow">'
        "https:&#x2F;&#x2F;acme.example&#x2F;jo...</a> today"
    )
    assert text == "Apply at https://acme.example/jobs/42 today"
    assert links == ["https://acme.example/jobs/42"]


def test_html_to_text_keeps_the_label_of_a_named_link() -> None:
    text, links = textutil.html_to_text('See <a href="https://acme.example">our site</a>.')
    assert text == "See our site."
    assert links == ["https://acme.example"]


def test_first_line_skips_blank_lines() -> None:
    assert textutil.first_line("\n\n  Acme | Remote  \nmore") == "Acme | Remote"
    assert textutil.first_line("") == ""


def test_find_urls_merges_hrefs_with_typed_addresses_and_trims_punctuation() -> None:
    urls = textutil.find_urls(
        "Site (https://acme.example/careers). Docs: https://docs.acme.example|next",
        ["https://acme.example/careers"],
    )
    assert urls == ["https://acme.example/careers", "https://docs.acme.example"]


def test_find_email_domains_ignores_free_mail() -> None:
    text = "Write to jobs@acme.example or to our founder at founder@gmail.com"
    assert textutil.find_email_domains(text) == ["acme.example"]


def test_find_bare_domains_ignores_technologies_and_full_links() -> None:
    line = "Acme (acme.io) | Node.js, ASP.NET, socket.io | https://other.example | U.S. only"
    assert textutil.find_bare_domains(line) == ["acme.io"]


def test_tokens_lowercase_words_and_keep_a_link_as_one_token() -> None:
    assert textutil.tokens("We’re hiring: Rust/Go devs! https://Acme.example/jobs?id=1.") == [
        "we’re",
        "hiring",
        "rust",
        "go",
        "devs",
        "https://acme.example/jobs?id=1",
    ]
