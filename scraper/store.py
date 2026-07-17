"""Supabase access for the worker, using the service-role key.

The service-role key bypasses RLS. That is correct for a trusted backend cron,
and exactly why this key must never reach the browser or Git.
"""
from __future__ import annotations

from typing import Any

from supabase import Client, create_client

from config import Config


class Store:
    def __init__(self, config: Config):
        self._client: Client = create_client(config.supabase_url, config.supabase_service_role_key)

    def tellus_org_id(self) -> str:
        res = self._client.table("organizations").select("id").eq("slug", "tellus").limit(1).execute()
        if not res.data:
            raise SystemExit("No 'tellus' organization found — apply the migrations first.")
        return res.data[0]["id"]

    def active_x_accounts(self, organization_id: str) -> list[dict[str, Any]]:
        res = (
            self._client.table("social_accounts")
            .select("id, handle, category")
            .eq("organization_id", organization_id)
            .eq("platform", "x")
            .eq("active", True)
            .order("handle")
            .execute()
        )
        return res.data or []

    def upsert_posts(self, rows: list[dict[str, Any]]) -> int:
        """Upsert on (organization_id, url); refresh metrics on repeat captures."""
        if not rows:
            return 0
        deduped = {row["url"]: row for row in rows if row.get("url")}
        payload = list(deduped.values())
        if not payload:
            return 0
        self._client.table("social_posts").upsert(payload, on_conflict="organization_id,url").execute()
        return len(payload)
