-- Healthcheck operativo de Tierly: solo estado técnico agregado, sin datos personales.

create table if not exists public.tierly_bot_health (
  bot_key text primary key check (bot_key = 'tierly-bot'),
  connected_at timestamptz,
  heartbeat_at timestamptz,
  last_error_at timestamptz,
  last_error_code text,
  connection_count bigint not null default 0 check (connection_count >= 0),
  heartbeat_count bigint not null default 0 check (heartbeat_count >= 0),
  error_count bigint not null default 0 check (error_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.tierly_bot_health enable row level security;
revoke all on table public.tierly_bot_health from public, anon, authenticated;
grant select, insert, update on public.tierly_bot_health to service_role;

create or replace function public.tierly_bot_health_heartbeat(
  p_bot_key text default 'tierly-bot', p_connected_at timestamptz default null
)
returns public.tierly_bot_health language plpgsql security invoker set search_path = public
as $$
declare result public.tierly_bot_health;
begin
  if p_bot_key <> 'tierly-bot' then raise exception 'bot_key no permitido'; end if;
  insert into public.tierly_bot_health (bot_key, connected_at, heartbeat_at, connection_count, heartbeat_count)
  values (p_bot_key, coalesce(p_connected_at, now()), now(), 1, 1)
  on conflict (bot_key) do update set
    connected_at = coalesce(excluded.connected_at, public.tierly_bot_health.connected_at),
    heartbeat_at = excluded.heartbeat_at,
    connection_count = public.tierly_bot_health.connection_count + case when p_connected_at is null then 0 else 1 end,
    heartbeat_count = public.tierly_bot_health.heartbeat_count + 1, updated_at = now();
  select * into result from public.tierly_bot_health where bot_key = p_bot_key;
  return result;
end;
$$;

create or replace function public.tierly_bot_health_error(
  p_error_code text, p_bot_key text default 'tierly-bot'
)
returns public.tierly_bot_health language plpgsql security invoker set search_path = public
as $$
declare result public.tierly_bot_health;
  safe_code text := left(regexp_replace(coalesce(p_error_code, 'unknown'), '[^a-z0-9_.-]', '_', 'gi'), 80);
begin
  if p_bot_key <> 'tierly-bot' then raise exception 'bot_key no permitido'; end if;
  insert into public.tierly_bot_health (bot_key, last_error_at, last_error_code, error_count)
  values (p_bot_key, now(), safe_code, 1)
  on conflict (bot_key) do update set last_error_at = now(), last_error_code = safe_code,
    error_count = public.tierly_bot_health.error_count + 1, updated_at = now();
  select * into result from public.tierly_bot_health where bot_key = p_bot_key;
  return result;
end;
$$;

revoke all on function public.tierly_bot_health_heartbeat(text, timestamptz) from public, anon, authenticated;
revoke all on function public.tierly_bot_health_error(text, text) from public, anon, authenticated;
grant execute on function public.tierly_bot_health_heartbeat(text, timestamptz) to service_role;
grant execute on function public.tierly_bot_health_error(text, text) to service_role;
