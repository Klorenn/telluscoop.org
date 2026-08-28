-- Agrega instagram_handle al perfil de gaming_players.

alter table public.gaming_players
  add column if not exists instagram_handle text;
