"""Command line: python -m stillhiring fetch | build | stats | serve | all."""

from __future__ import annotations

import argparse
import contextlib
import functools
import http.server
import sys
from pathlib import Path

from . import config


def _add_data_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--raw", type=Path, default=config.RAW_DIR, help="raw thread directory")
    parser.add_argument("--since", default=config.START_MONTH, help="first month, YYYY-MM")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="stillhiring", description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)

    fetch = commands.add_parser("fetch", help="download threads that are new or still open")
    _add_data_args(fetch)
    fetch.add_argument("--refresh", action="store_true", help="download every thread again")

    build = commands.add_parser("build", help="write the site's data files")
    _add_data_args(build)
    build.add_argument("--out", type=Path, default=config.SITE_DATA_DIR, help="output directory")
    build.add_argument("--allow-gaps", action="store_true", help="build from incomplete data")

    stats = commands.add_parser("stats", help="parser coverage and matches worth a second look")
    _add_data_args(stats)
    stats.add_argument("--top", type=int, default=15, help="rows per list")
    stats.add_argument("--company", metavar="REGEX", help="show how matching companies were built")

    serve = commands.add_parser("serve", help="serve the site locally")
    serve.add_argument("--port", type=int, default=8000)
    serve.add_argument("--dir", type=Path, default=config.SITE_DIR)

    everything = commands.add_parser("all", help="fetch, build and print stats")
    _add_data_args(everything)
    everything.add_argument("--out", type=Path, default=config.SITE_DATA_DIR)
    everything.add_argument("--top", type=int, default=15)
    everything.add_argument("--allow-gaps", action="store_true")
    return parser


def cmd_fetch(args: argparse.Namespace) -> int:
    from . import hn

    result = hn.sync(
        hn.Client(),
        args.raw,
        start_month=args.since,
        refresh=getattr(args, "refresh", False),
    )
    print(f"fetched {len(result.fetched)}, already stored {len(result.skipped)}")
    return 0


def cmd_build(args: argparse.Namespace) -> int:
    from . import build

    summary = build.build(
        args.raw, args.out, start_month=args.since, allow_gaps=getattr(args, "allow_gaps", False)
    )
    print(
        f"{summary['threads']} threads, {summary['posts']} posts, "
        f"{summary['companies']} companies -> {args.out}"
    )
    return 0


def cmd_stats(args: argparse.Namespace) -> int:
    from . import stats

    if getattr(args, "company", None):
        print(stats.describe(args.raw, args.company, start_month=args.since))
    else:
        print(stats.report(args.raw, start_month=args.since, top=args.top))
    return 0


def cmd_serve(args: argparse.Namespace) -> int:
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(args.dir))
    with http.server.ThreadingHTTPServer(("127.0.0.1", args.port), handler) as server:
        print(f"http://127.0.0.1:{args.port}/  (Ctrl-C to stop)")
        with contextlib.suppress(KeyboardInterrupt):
            server.serve_forever()
    return 0


def cmd_all(args: argparse.Namespace) -> int:
    return cmd_fetch(args) or cmd_build(args) or cmd_stats(args)


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    handlers = {
        "fetch": cmd_fetch,
        "build": cmd_build,
        "stats": cmd_stats,
        "serve": cmd_serve,
        "all": cmd_all,
    }
    try:
        return handlers[args.command](args)
    except Exception as error:  # noqa: BLE001 - one readable line instead of a traceback
        from .build import BuildError
        from .hn import HNError

        if isinstance(error, (HNError, BuildError, FileNotFoundError)):
            print(f"error: {error}", file=sys.stderr)
            return 1
        raise
