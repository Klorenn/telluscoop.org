-- Edge functions (discord-verify, chess) write via service_role, not RLS.
-- The chess module migration only granted to authenticated, so service_role
-- inserts into gaming_chess_games failed with "permission denied for table".
-- Grant service_role full access on every gaming_* table so backend flows work
-- regardless of RLS (service_role bypasses RLS by default).
grant all on table public.gaming_events to service_role;
grant all on table public.gaming_tournaments to service_role;
grant all on table public.gaming_matches to service_role;
grant all on table public.gaming_match_participants to service_role;
grant all on table public.gaming_scores to service_role;
grant all on table public.gaming_rewards to service_role;
grant all on table public.gaming_chess_games to service_role;
grant all on table public.gaming_bot_notifications to service_role;