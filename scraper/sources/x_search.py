"""X topic search via the SearchTimeline GraphQL endpoint, authenticated with
the secondary account cookies. Same fragility as x_graphql: the query id
(X_QID_SEARCH) rotates on x.com deploys — refresh it from the Network tab.
"""
from __future__ import annotations

import json
import os

from scrapling.fetchers import Fetcher

from .base import ScrapedPost, SourceError, parse_count
from .x_graphql import _headers, _TWEET_FEATURES, _query_ids


def _search_query_id() -> str:
    return os.environ.get("X_QID_SEARCH") or _query_ids().get("search", "")


def fetch(query: str, auth_token: str, ct0: str, max_posts: int) -> list[ScrapedPost]:
    qid = _search_query_id()
    if not qid:
        raise SourceError("Missing X search query id — set X_QID_SEARCH or x_endpoints.json 'search'")
    headers = _headers(ct0, auth_token)
    variables = {"rawQuery": query, "count": max_posts, "querySource": "typed_query", "product": "Latest"}
    page = Fetcher.get(
        f"https://x.com/i/api/graphql/{qid}/SearchTimeline",
        params={"variables": json.dumps(variables), "features": json.dumps(_TWEET_FEATURES)},
        headers=headers,
        impersonate="chrome",
    )
    if page.status == 404:
        raise SourceError("Search 404 — the query id is stale; refresh X_QID_SEARCH")
    if page.status in (401, 403):
        raise SourceError(f"Search {page.status} — cookies rejected; refresh auth_token/ct0")
    if page.status != 200:
        raise SourceError(f"Search returned {page.status}")
    return _parse(page.json(), max_posts)


def _parse(data: dict, max_posts: int) -> list[ScrapedPost]:
    posts: list[ScrapedPost] = []
    instructions = (
        data.get("data", {}).get("search_by_raw_query", {})
        .get("search_timeline", {}).get("timeline", {}).get("instructions", [])
    )
    for instruction in instructions:
        for entry in instruction.get("entries", []):
            if not entry.get("entryId", "").startswith("tweet-"):
                continue
            result = (
                entry.get("content", {}).get("itemContent", {})
                .get("tweet_results", {}).get("result", {})
            )
            if result.get("__typename") == "TweetWithVisibilityResults":
                result = result.get("tweet", {})
            legacy = result.get("legacy")
            if not legacy or legacy.get("retweeted_status_result"):
                continue
            core = result.get("core", {}).get("user_results", {}).get("result", {})
            handle = core.get("legacy", {}).get("screen_name") or core.get("core", {}).get("screen_name")
            if not handle:
                continue
            note = result.get("note_tweet", {}).get("note_tweet_results", {}).get("result", {})
            text = note.get("text") or legacy.get("full_text") or ""
            media = (legacy.get("extended_entities", {}).get("media") or [{}])[0]
            posts.append(ScrapedPost(
                author_handle=handle,
                content=text.strip(),
                url=f"https://x.com/{handle}/status/{legacy.get('id_str')}",
                posted_at=legacy.get("created_at"),
                likes=parse_count(legacy.get("favorite_count")),
                reposts=parse_count(legacy.get("retweet_count")),
                replies=parse_count(legacy.get("reply_count")),
                views=parse_count((result.get("views") or {}).get("count")),
                media_url=media.get("media_url_https"),
            ))
            if len(posts) >= max_posts:
                return posts
    return posts
