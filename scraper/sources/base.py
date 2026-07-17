"""Shared post shape produced by every X source backend."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class ScrapedPost:
    """One captured post, normalized across sources (GraphQL, Nitter)."""

    author_handle: str
    content: str
    url: str | None = None
    posted_at: str | None = None  # ISO 8601 or None
    likes: int = 0
    reposts: int = 0
    replies: int = 0
    views: int = 0
    media_url: str | None = None

    def to_row(self, organization_id: str, account_id: str | None) -> dict[str, Any]:
        """Map to a public.social_posts row. source is always 'scraper' here."""
        return {
            "organization_id": organization_id,
            "account_id": account_id,
            "platform": "x",
            "author_handle": self.author_handle,
            "url": self.url,
            "content": self.content,
            "posted_at": self.posted_at,
            "likes": max(0, int(self.likes)),
            "reposts": max(0, int(self.reposts)),
            "replies": max(0, int(self.replies)),
            "views": max(0, int(self.views)),
            "media_url": self.media_url,
            "source": "scraper",
        }


class SourceError(RuntimeError):
    """Raised when a source backend cannot return posts for an account."""


def parse_count(raw: str | int | None) -> int:
    """Turn '1.2K', '3,4 mil', '2M', 4200 into an int. Best effort."""
    if raw is None:
        return 0
    if isinstance(raw, (int, float)):
        return int(raw)
    text = str(raw).strip().lower().replace(",", "").replace(" ", "")
    if not text:
        return 0
    multiplier = 1
    for suffix, factor in (("k", 1_000), ("mil", 1_000), ("m", 1_000_000), ("mill", 1_000_000)):
        if text.endswith(suffix):
            multiplier = factor
            text = text[: -len(suffix)]
            break
    try:
        return int(float(text) * multiplier)
    except ValueError:
        return 0
