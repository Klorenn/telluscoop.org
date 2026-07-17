"""Nitter fallback source.

Nitter is an alternative read-only front end for X. It serves plain, stable
HTML and needs no login, so it never risks the scraper account. The downside is
that public instances go up and down; we try each configured instance in turn.
"""
from __future__ import annotations

import re

from scrapling.fetchers import Fetcher

from .base import ScrapedPost, SourceError, parse_count

_STAT_ICONS = {
    "icon-comment": "replies",
    "icon-retweet": "reposts",
    "icon-heart": "likes",
    "icon-quote": "reposts",
}


def _absolute(instance: str, href: str) -> str:
    if not href:
        return ""
    if href.startswith("http"):
        return href
    return f"{instance}{href}"


def _canonical_url(instance: str, href: str) -> str:
    # Rewrite the Nitter permalink back to x.com and drop #m / query noise.
    path = href.split("#", 1)[0]
    return f"https://x.com{path}" if path.startswith("/") else _absolute(instance, path)


def fetch(handle: str, instances: tuple[str, ...], max_posts: int) -> list[ScrapedPost]:
    handle = handle.lstrip("@")
    last_error: Exception | None = None
    for instance in instances:
        try:
            page = Fetcher.get(f"{instance}/{handle}", stealthy_headers=True, impersonate="chrome")
            if page.status != 200:
                raise SourceError(f"{instance} returned {page.status}")
            posts = _parse(page, instance, handle, max_posts)
            if posts:
                return posts
        except Exception as exc:  # noqa: BLE001 — try the next instance
            last_error = exc
            continue
    raise SourceError(f"All Nitter instances failed for @{handle}: {last_error}")


def _parse(page, instance: str, handle: str, max_posts: int) -> list[ScrapedPost]:
    items = page.css(".timeline-item")
    posts: list[ScrapedPost] = []
    for item in items:
        if item.css(".pinned") or item.css(".retweet-header"):
            continue  # skip pinned tweets and retweets; we want the author's own posts
        content = item.css_first(".tweet-content")
        if content is None:
            continue
        text = content.get_all_text(strip=True) if hasattr(content, "get_all_text") else content.text
        link = item.css_first("a.tweet-link")
        href = link.attrib.get("href", "") if link is not None else ""
        date_el = item.css_first("span.tweet-date a")
        posted_at = date_el.attrib.get("title") if date_el is not None else None

        stats = {"replies": 0, "reposts": 0, "likes": 0, "views": 0}
        for stat in item.css(".tweet-stat"):
            icon = stat.css_first(".icon-container span")
            number = stat.css_first(".icon-container")
            if icon is None or number is None:
                continue
            classes = " ".join(icon.attrib.get("class", "").split())
            value = parse_count(re.sub(r"[^0-9.,kKmM]", "", number.text or ""))
            for css_class, key in _STAT_ICONS.items():
                if css_class in classes:
                    stats[key] = max(stats[key], value)

        posts.append(ScrapedPost(
            author_handle=handle,
            content=(text or "").strip(),
            url=_canonical_url(instance, href),
            posted_at=posted_at,
            **stats,
        ))
        if len(posts) >= max_posts:
            break
    return posts
