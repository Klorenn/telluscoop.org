"""Runtime configuration for the social scraper worker.

Every secret is read from the environment. Nothing is committed. Locally these
come from the repo-root .env.local; in CI they come from GitHub Actions secrets.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field

from dotenv import load_dotenv

# Load repo-root .env.local when present (local runs). In CI the vars are
# already in the environment, and the file is absent, so this is a no-op.
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.local"))


def _require(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise SystemExit(f"Missing required environment variable: {name}")
    return value


@dataclass(frozen=True)
class Config:
    supabase_url: str = field(default_factory=lambda: _require("SUPABASE_URL"))
    # Service-role key bypasses RLS. Worker-only. Never ship to the frontend.
    supabase_service_role_key: str = field(default_factory=lambda: _require("SUPABASE_SERVICE_ROLE_KEY"))

    # X source — GraphQL via authenticated cookies (primary).
    x_auth_token: str = field(default_factory=lambda: os.environ.get("X_SCRAPER_AUTH_TOKEN", "").strip())
    x_ct0: str = field(default_factory=lambda: os.environ.get("X_SCRAPER_CT0", "").strip())

    # X source — Nitter instances (fallback, no cookies). Comma-separated.
    nitter_instances: tuple[str, ...] = field(
        default_factory=lambda: tuple(
            i.strip().rstrip("/") for i in os.environ.get(
                "NITTER_INSTANCES", "https://nitter.net,https://nitter.poast.org"
            ).split(",") if i.strip()
        )
    )

    # Politeness: seconds between accounts (min,max) for randomized delay.
    delay_min: float = field(default_factory=lambda: float(os.environ.get("SCRAPER_DELAY_MIN", "20")))
    delay_max: float = field(default_factory=lambda: float(os.environ.get("SCRAPER_DELAY_MAX", "55")))
    # Max posts kept per account per run.
    max_posts: int = field(default_factory=lambda: int(os.environ.get("SCRAPER_MAX_POSTS", "20")))

    @property
    def has_x_cookies(self) -> bool:
        return bool(self.x_auth_token and self.x_ct0)
