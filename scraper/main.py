"""Social scraper worker — Phase 2.

For each active X account in the Tellus org, fetch recent posts and upsert them
into public.social_posts with source='scraper'. Primary source is the X GraphQL
API (authenticated with the secondary account's cookies); Nitter is the
fallback. Runs are deliberately slow and randomized to stay polite and to keep
the read-only scraper account low-profile.

Usage:
    python main.py            # all active accounts
    python main.py midudev    # a single handle (no @)
"""
from __future__ import annotations

import random
import sys
import time

from config import Config
from sources import SourceError
from sources import nitter, x_graphql
from store import Store


def fetch_account(config: Config, handle: str) -> tuple[list, str]:
    """Return (posts, source_used). Try GraphQL, then Nitter."""
    if config.has_x_cookies:
        try:
            posts = x_graphql.fetch(handle, config.x_auth_token, config.x_ct0, config.max_posts)
            if posts:
                return posts, "graphql"
        except SourceError as exc:
            print(f"  graphql: {exc}")
    try:
        posts = nitter.fetch(handle, config.nitter_instances, config.max_posts)
        return posts, "nitter"
    except SourceError as exc:
        print(f"  nitter: {exc}")
        return [], "none"


def main() -> int:
    config = Config()
    store = Store(config)
    org_id = store.tellus_org_id()

    only = sys.argv[1].lstrip("@").lower() if len(sys.argv) > 1 else None
    accounts = store.active_x_accounts(org_id)
    if only:
        accounts = [a for a in accounts if a["handle"].lower() == only]
    if not accounts:
        print("No matching active X accounts.")
        return 0

    if not config.has_x_cookies:
        print("No X cookies set — using Nitter fallback only.")

    total = 0
    for index, account in enumerate(accounts):
        handle = account["handle"]
        print(f"[{index + 1}/{len(accounts)}] @{handle}")
        posts, source = fetch_account(config, handle)
        rows = [p.to_row(org_id, account["id"]) for p in posts]
        saved = store.upsert_posts(rows)
        total += saved
        print(f"  {source}: {saved} posts upserted")

        if index < len(accounts) - 1:
            delay = random.uniform(config.delay_min, config.delay_max)
            print(f"  sleeping {delay:.0f}s")
            time.sleep(delay)

    print(f"Done. {total} posts upserted across {len(accounts)} accounts.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
