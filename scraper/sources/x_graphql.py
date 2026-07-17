"""Primary X source: the same GraphQL endpoints the x.com web app calls,
authenticated with the secondary account's cookies (auth_token + ct0).

This is the most reliable path and returns exact metrics, but X rotates the
GraphQL query ids on every web deploy. When a call starts returning 404, open
x.com in a logged-in browser, watch the Network tab for `UserByScreenName` and
`UserTweets`, and paste the fresh query ids into scraper/x_endpoints.json
(or the X_QID_* env vars). The public web bearer token below is long-lived.
"""
from __future__ import annotations

import json
import os

from scrapling.fetchers import Fetcher

from .base import ScrapedPost, SourceError, parse_count

# Long-lived public web client bearer. Not a secret — it ships in x.com's JS.
_WEB_BEARER = (
    "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D"
    "1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA"
)

_ENDPOINTS_FILE = os.path.join(os.path.dirname(__file__), "..", "x_endpoints.json")


def _query_ids() -> dict[str, str]:
    """Query ids come from env first, then the json file. Both may go stale."""
    data: dict[str, str] = {}
    if os.path.exists(_ENDPOINTS_FILE):
        with open(_ENDPOINTS_FILE, encoding="utf-8") as handle:
            data = json.load(handle)
    return {
        "user_by_screen_name": os.environ.get("X_QID_USER") or data.get("user_by_screen_name", ""),
        "user_tweets": os.environ.get("X_QID_TWEETS") or data.get("user_tweets", ""),
        "search": os.environ.get("X_QID_SEARCH") or data.get("search", ""),
    }


def _headers(ct0: str, auth_token: str) -> dict[str, str]:
    return {
        "authorization": _WEB_BEARER,
        "x-csrf-token": ct0,
        "cookie": f"auth_token={auth_token}; ct0={ct0}",
        "x-twitter-active-user": "yes",
        "x-twitter-auth-type": "OAuth2Session",
        "content-type": "application/json",
        "accept": "*/*",
    }


def _get_json(url: str, variables: dict, features: dict, headers: dict):
    page = Fetcher.get(
        url,
        params={"variables": json.dumps(variables), "features": json.dumps(features)},
        headers=headers,
        impersonate="chrome",
    )
    if page.status == 404:
        raise SourceError("GraphQL 404 — the query id is stale; refresh x_endpoints.json")
    if page.status in (401, 403):
        raise SourceError(f"GraphQL {page.status} — cookies rejected; refresh auth_token/ct0")
    if page.status != 200:
        raise SourceError(f"GraphQL returned {page.status}")
    return page.json()


_USER_FEATURES = {"hidden_profile_subscriptions_enabled": True, "responsive_web_graphql_exclude_directive_enabled": True,
                  "verified_phone_label_enabled": False, "subscriptions_verification_info_is_identity_verified_enabled": True,
                  "responsive_web_graphql_skip_user_profile_image_extensions_enabled": False,
                  "responsive_web_graphql_timeline_navigation_enabled": True}

_TWEET_FEATURES = {"responsive_web_graphql_exclude_directive_enabled": True, "responsive_web_graphql_timeline_navigation_enabled": True,
                   "creator_subscriptions_tweet_preview_api_enabled": True, "longform_notetweets_consumption_enabled": True,
                   "longform_notetweets_rich_text_read_enabled": True, "longform_notetweets_inline_media_enabled": True,
                   "responsive_web_enhance_cards_enabled": False, "tweetypie_unmention_optimization_enabled": True,
                   "view_counts_everywhere_api_enabled": True, "responsive_web_twitter_article_tweet_consumption_enabled": True}


def _resolve_user_id(handle: str, qid: str, headers: dict) -> str:
    data = _get_json(
        f"https://x.com/i/api/graphql/{qid}/UserByScreenName",
        {"screen_name": handle, "withSafetyModeUserFields": True},
        _USER_FEATURES,
        headers,
    )
    user_id = (data.get("data", {}).get("user", {}).get("result", {}) or {}).get("rest_id")
    if not user_id:
        raise SourceError(f"Could not resolve user id for @{handle}")
    return user_id


def fetch(handle: str, auth_token: str, ct0: str, max_posts: int) -> list[ScrapedPost]:
    handle = handle.lstrip("@")
    qids = _query_ids()
    if not qids["user_by_screen_name"] or not qids["user_tweets"]:
        raise SourceError("Missing X GraphQL query ids — populate scraper/x_endpoints.json")
    headers = _headers(ct0, auth_token)
    user_id = _resolve_user_id(handle, qids["user_by_screen_name"], headers)

    data = _get_json(
        f"https://x.com/i/api/graphql/{qids['user_tweets']}/UserTweets",
        {"userId": user_id, "count": max_posts, "includePromotedContent": False,
         "withQuickPromoteEligibilityTweetFields": False, "withVoice": False, "withV2Timeline": True},
        _TWEET_FEATURES,
        headers,
    )
    return _parse_timeline(data, handle, max_posts)


def _parse_timeline(data: dict, handle: str, max_posts: int) -> list[ScrapedPost]:
    posts: list[ScrapedPost] = []
    instructions = (
        data.get("data", {}).get("user", {}).get("result", {})
        .get("timeline_v2", {}).get("timeline", {}).get("instructions", [])
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
                continue  # skip non-tweets and retweets
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
