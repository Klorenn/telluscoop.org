# Tierly V0 — Discord Intelligence: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El bot de Tierly observa Discord presence, lo convierte en sesiones de juego y rollups agregados por comunidad, y un panel admin muestra juegos activos, jugadores únicos, tendencias y eventos sugeridos.

**Architecture:** El bot (proceso Node de larga vida en GCP) escribe directo a Postgres con service-role: abre una fila de sesión al detectar un juego, y un heartbeat cada 5 minutos contra su caché de presencias cierra las que terminaron. Jobs de `pg_cron` agregan a rollups permanentes, purgan sesiones viejas y generan sugerencias. El panel `ops/tierly/` se transforma de gestión de brackets a panel de inteligencia, leyendo solo datos agregados bajo RLS por `community_admins`.

**Tech Stack:** Node 22 (ESM, sin bundler), discord.js 14, @supabase/supabase-js 2, Postgres/Supabase con RLS y `pg_cron`, vanilla JS en el panel, `node --test` para tests.

**Spec:** `docs/superpowers/specs/2026-09-28-tierly-v0-discord-intelligence-design.md`

## Global Constraints

- **Sin bundler, sin TypeScript, sin lint.** Todo es JS plano. Módulos del bot en ESM (`"type":"module"` ya está en `discord-bot/package.json`). El panel usa IIFE vanilla, como `ops/tierly/app.js` hoy.
- **Tests:** `npm test` corre `node --test tests/*.test.mjs`. Dos estilos conviven en el repo: tests de lógica pura (importan un `.mjs` y prueban funciones) y tests estáticos (leen un archivo fuente como texto y hacen aserciones con regex). Ambos son válidos; este plan usa lógica pura para los módulos nuevos y estáticos para SQL/panel, siguiendo lo que ya existe.
- **Secretos:** `SUPABASE_SERVICE_ROLE_KEY` vive SOLO en `discord-bot/.env`. Nunca en el panel, nunca en `config.js`, nunca en git. El panel usa la publishable key, que es pública por diseño.
- **Cache busting:** `ops/tierly/index.html` debe referenciar `app.js` y `styles.css` con `?v=YYYYMMDD-NN` y ambos con el MISMO valor. Hoy no lo tiene; la Tarea 8 lo agrega y lo testea.
- **Commits:** conventional commits, sin atribución a IA.
- **Migraciones:** archivos nuevos en `supabase/migrations/` con nombre `YYYYMMDDHHMMSS_descripcion.sql`. Nunca editar una migración ya existente.
- **RLS:** toda tabla nueva con RLS habilitada. Lectura solo para admins del guild vía `community_admins`. Escritura solo service-role. Ninguna tabla nueva legible por `anon`.
- **Defaults de configuración** (columnas en `communities`): `retention_days` 30, `session_cap_minutes` 480, `stale_session_hours` 12, `suggestion_threshold` 5.

---

### Task 1: Schema V0 — tenencia, catálogo de juegos y hechos

**Files:**
- Create: `supabase/migrations/20260929090000_tierly_v0_schema.sql`
- Test: `tests/tierly-v0-schema.test.mjs`

**Interfaces:**
- Consumes: nada (primera tarea).
- Produces: las tablas `communities`, `community_admins`, `observed_members`, `games`, `game_aliases`, `play_sessions`, `daily_game_rollups`, `suggested_events`. Toda tarea posterior usa exactamente estos nombres de tabla y columna.

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/tierly-v0-schema.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  new URL("../supabase/migrations/20260929090000_tierly_v0_schema.sql", import.meta.url),
  "utf8",
);

const TABLES = [
  "communities",
  "community_admins",
  "observed_members",
  "games",
  "game_aliases",
  "play_sessions",
  "daily_game_rollups",
  "suggested_events",
];

test("crea todas las tablas del modelo V0", () => {
  for (const t of TABLES) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${t}\\b`, "i"), `falta tabla ${t}`);
  }
});

test("habilita RLS en todas las tablas nuevas", () => {
  for (const t of TABLES) {
    assert.match(sql, new RegExp(`alter table public\\.${t} enable row level security`, "i"), `falta RLS en ${t}`);
  }
});

test("ninguna tabla nueva concede acceso a anon", () => {
  assert.ok(!/to\s+anon/i.test(sql), "V0 no expone datos a anon");
});

test("los umbrales son configurables por comunidad, no constantes", () => {
  assert.match(sql, /retention_days\s+integer\s+not null default 30/i);
  assert.match(sql, /session_cap_minutes\s+integer\s+not null default 480/i);
  assert.match(sql, /stale_session_hours\s+integer\s+not null default 12/i);
  assert.match(sql, /suggestion_threshold\s+integer\s+not null default 5/i);
});

test("una sola sesion abierta por (guild, usuario, juego)", () => {
  assert.match(
    sql,
    /create unique index[\s\S]*play_sessions[\s\S]*\(guild_id, discord_user_id, game_id\)[\s\S]*where ended_at is null/i,
  );
});

test("rollups son unicos por guild+juego+dia", () => {
  assert.match(
    sql,
    /create unique index[\s\S]*daily_game_rollups[\s\S]*\(guild_id, game_id, day\)/i,
  );
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `node --test tests/tierly-v0-schema.test.mjs`
Expected: FAIL con `ENOENT` — el archivo de migración no existe todavía.

- [ ] **Step 3: Escribir la migración**

Crear `supabase/migrations/20260929090000_tierly_v0_schema.sql`:

```sql
-- Tierly V0: modelo de inteligencia de presence, multi-tenant por guild.

create table if not exists public.communities (
  guild_id text primary key,
  name text not null,
  icon_url text,
  installed_at timestamptz not null default now(),
  locale text not null default 'es',
  timezone text not null default 'America/Santiago',
  presence_enabled boolean not null default true,
  retention_days integer not null default 30,
  session_cap_minutes integer not null default 480,
  stale_session_hours integer not null default 12,
  suggestion_threshold integer not null default 5
);

create table if not exists public.community_admins (
  guild_id text not null references public.communities(guild_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  discord_user_id text,
  role text not null default 'admin',
  created_at timestamptz not null default now(),
  primary key (guild_id, user_id)
);

create table if not exists public.observed_members (
  guild_id text not null references public.communities(guild_id) on delete cascade,
  discord_user_id text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  opted_in boolean not null default false,
  primary key (guild_id, discord_user_id)
);

create table if not exists public.games (
  id bigint generated always as identity primary key,
  canonical_name text not null unique,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.game_aliases (
  raw_activity_name text primary key,
  game_id bigint not null references public.games(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.play_sessions (
  id bigint generated always as identity primary key,
  guild_id text not null references public.communities(guild_id) on delete cascade,
  discord_user_id text not null,
  game_id bigint not null references public.games(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  last_heartbeat_at timestamptz not null default now(),
  closed_reason text check (closed_reason in ('normal','heartbeat','crash','timeout')),
  minutes integer generated always as (
    case when ended_at is null then null
    else greatest(0, (extract(epoch from (ended_at - started_at)) / 60)::int)
    end
  ) stored
);

create unique index if not exists play_sessions_one_open_per_game
  on public.play_sessions (guild_id, discord_user_id, game_id)
  where ended_at is null;

create index if not exists play_sessions_guild_started
  on public.play_sessions (guild_id, started_at desc);

create table if not exists public.daily_game_rollups (
  id bigint generated always as identity primary key,
  guild_id text not null references public.communities(guild_id) on delete cascade,
  game_id bigint not null references public.games(id) on delete cascade,
  day date not null,
  unique_players integer not null default 0,
  total_minutes integer not null default 0,
  session_count integer not null default 0
);

create unique index if not exists daily_game_rollups_unique
  on public.daily_game_rollups (guild_id, game_id, day);

create table if not exists public.suggested_events (
  id bigint generated always as identity primary key,
  guild_id text not null references public.communities(guild_id) on delete cascade,
  game_id bigint not null references public.games(id) on delete cascade,
  generated_at timestamptz not null default now(),
  window_days integer not null default 7,
  player_count integer not null,
  status text not null default 'pending' check (status in ('pending','accepted','dismissed'))
);

create index if not exists suggested_events_pending
  on public.suggested_events (guild_id, game_id)
  where status = 'pending';

-- RLS: lectura solo para admins del guild; escritura solo service-role.

alter table public.communities enable row level security;
alter table public.community_admins enable row level security;
alter table public.observed_members enable row level security;
alter table public.games enable row level security;
alter table public.game_aliases enable row level security;
alter table public.play_sessions enable row level security;
alter table public.daily_game_rollups enable row level security;
alter table public.suggested_events enable row level security;

create or replace function public.is_community_admin(target_guild text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.community_admins ca
    where ca.guild_id = target_guild and ca.user_id = auth.uid()
  );
$$;

create policy communities_read on public.communities
  for select to authenticated
  using (public.is_community_admin(guild_id));

create policy community_admins_read on public.community_admins
  for select to authenticated
  using (user_id = auth.uid());

create policy observed_members_read on public.observed_members
  for select to authenticated
  using (public.is_community_admin(guild_id));

create policy games_read on public.games
  for select to authenticated
  using (true);

create policy game_aliases_read on public.game_aliases
  for select to authenticated
  using (true);

create policy play_sessions_read on public.play_sessions
  for select to authenticated
  using (public.is_community_admin(guild_id));

create policy daily_game_rollups_read on public.daily_game_rollups
  for select to authenticated
  using (public.is_community_admin(guild_id));

create policy suggested_events_read on public.suggested_events
  for select to authenticated
  using (public.is_community_admin(guild_id));

grant select, insert, update, delete on
  public.communities,
  public.community_admins,
  public.observed_members,
  public.games,
  public.game_aliases,
  public.play_sessions,
  public.daily_game_rollups,
  public.suggested_events
to service_role;
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `node --test tests/tierly-v0-schema.test.mjs`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260929090000_tierly_v0_schema.sql tests/tierly-v0-schema.test.mjs
git commit -m "feat: schema V0 de inteligencia de presence"
```

---

### Task 2: Retiro de la capa de brackets

**Files:**
- Create: `supabase/migrations/20260929091000_tierly_drop_bracket_layer.sql`
- Test: `tests/tierly-v0-schema.test.mjs` (agregar bloque)
- Delete: `tests/leaderboard-public.test.mjs`

**Interfaces:**
- Consumes: nada de la Tarea 1.
- Produces: la ausencia de `gaming_events`, `gaming_tournaments`, `gaming_matches`, `gaming_rewards`, `gaming_tournament_registrations`, `gaming_bot_notifications` y sus vistas. `gaming_players` y `gaming_match_participants` SOBREVIVEN porque Racer y Chess dependen de ellas.

- [ ] **Step 1: Verificar dependencias antes de borrar**

Antes de escribir el DROP, confirmar qué depende de cada tabla. Correr contra la base:

```sql
select
  dependent.relname as objeto_dependiente,
  source.relname   as depende_de
from pg_depend d
join pg_rewrite r on r.oid = d.objid
join pg_class dependent on dependent.oid = r.ev_class
join pg_class source on source.oid = d.refobjid
where source.relname in (
  'gaming_events','gaming_tournaments','gaming_matches',
  'gaming_rewards','gaming_tournament_registrations','gaming_bot_notifications'
)
and dependent.relname <> source.relname
order by 2, 1;
```

Si aparece algo de Racer o Chess (`gaming_racer_*`, `gaming_chess_*`), PARAR y reportar: significa que el acoplamiento es mayor al mapeado y el alcance del borrado hay que revisarlo con el humano antes de seguir.

- [ ] **Step 2: Escribir el test que falla**

Agregar al final de `tests/tierly-v0-schema.test.mjs`:

```js
const dropSql = readFileSync(
  new URL("../supabase/migrations/20260929091000_tierly_drop_bracket_layer.sql", import.meta.url),
  "utf8",
);

test("elimina la capa de brackets", () => {
  for (const t of [
    "gaming_bot_notifications",
    "gaming_tournament_registrations",
    "gaming_rewards",
    "gaming_matches",
    "gaming_tournaments",
    "gaming_events",
  ]) {
    assert.match(dropSql, new RegExp(`drop table if exists public\\.${t}`, "i"), `falta drop de ${t}`);
  }
});

test("conserva las tablas de las que dependen racer y chess", () => {
  assert.ok(!/drop table if exists public\.gaming_players\b/i.test(dropSql));
  assert.ok(!/drop table if exists public\.gaming_match_participants\b/i.test(dropSql));
  assert.ok(!/drop table if exists public\.gaming_chess/i.test(dropSql));
  assert.ok(!/drop table if exists public\.gaming_racer/i.test(dropSql));
});
```

- [ ] **Step 3: Correr el test para verificar que falla**

Run: `node --test tests/tierly-v0-schema.test.mjs`
Expected: FAIL con `ENOENT` en la migración de drop.

- [ ] **Step 4: Escribir la migración**

Crear `supabase/migrations/20260929091000_tierly_drop_bracket_layer.sql`:

```sql
-- Tierly V0: retiro de la capa de brackets/torneos.
-- gaming_players y gaming_match_participants se CONSERVAN: racer y chess dependen de ellas.

drop view if exists public.gaming_events_catalog_public_view;
drop view if exists public.event_bracket_public_view;
drop view if exists public.gaming_rewards_public_view;
drop view if exists public.leaderboard_public_view;

drop function if exists public.tierly_seed_bracket(bigint);
drop function if exists public.tierly_advance_bracket(bigint);

drop table if exists public.gaming_bot_notifications;
drop table if exists public.gaming_tournament_registrations;
drop table if exists public.gaming_rewards;
drop table if exists public.gaming_matches cascade;
drop table if exists public.gaming_tournaments cascade;
drop table if exists public.gaming_events cascade;
```

Nota sobre `cascade`: solo en las tres tablas del bracket, porque tienen FKs entre sí. Si el Step 1 reveló dependencias fuera del bracket, esas hay que resolverlas explícitamente, NO ampliando el `cascade`.

- [ ] **Step 5: Correr el test para verificar que pasa**

Run: `node --test tests/tierly-v0-schema.test.mjs`
Expected: PASS, 8 tests.

- [ ] **Step 6: Borrar el test que prueba la UI de bracket**

`tests/leaderboard-public.test.mjs` afirma que la página pública renderiza bracket y rewards. Eso deja de ser verdad.

```bash
rm tests/leaderboard-public.test.mjs
node --test tests/*.test.mjs
```

Expected: pasan todos menos los que dependen del leaderboard público, que se limpian en la Tarea 9. Anotar cuáles fallan; no arreglarlos acá.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260929091000_tierly_drop_bracket_layer.sql tests/tierly-v0-schema.test.mjs
git rm tests/leaderboard-public.test.mjs
git commit -m "feat: retirar capa de brackets y torneos"
```

---

### Task 3: Normalización de nombres de juego

**Files:**
- Create: `discord-bot/game-normalize.mjs`
- Test: `tests/tierly-game-normalize.test.mjs`

**Interfaces:**
- Consumes: nada.
- Produces: `normalizeGameName(raw) -> string` (nombre canónico, minúsculas, sin espacios extra ni sufijos de edición) y `displayNameFor(raw) -> string` (nombre limpio para mostrar, conservando mayúsculas originales). La Tarea 5 los importa.

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/tierly-game-normalize.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeGameName, displayNameFor } from "../discord-bot/game-normalize.mjs";

test("colapsa espacios y mayusculas al mismo canonico", () => {
  const canon = normalizeGameName("Fortnite");
  assert.equal(normalizeGameName("  Fortnite  "), canon);
  assert.equal(normalizeGameName("FORTNITE"), canon);
  assert.equal(normalizeGameName("Fortnite "), canon);
});

test("ignora sufijos de edicion comunes", () => {
  const canon = normalizeGameName("Minecraft");
  assert.equal(normalizeGameName("Minecraft: Java Edition"), canon);
  assert.equal(normalizeGameName("Minecraft Bedrock Edition"), canon);
});

test("juegos distintos no colisionan", () => {
  assert.notEqual(normalizeGameName("Valorant"), normalizeGameName("Valheim"));
});

test("el display name conserva la forma legible", () => {
  assert.equal(displayNameFor("  Rocket League  "), "Rocket League");
  assert.equal(displayNameFor("Minecraft: Java Edition"), "Minecraft");
});

test("entrada vacia o invalida devuelve cadena vacia", () => {
  assert.equal(normalizeGameName(""), "");
  assert.equal(normalizeGameName(null), "");
  assert.equal(normalizeGameName(undefined), "");
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `node --test tests/tierly-game-normalize.test.mjs`
Expected: FAIL — no se puede resolver `../discord-bot/game-normalize.mjs`.

- [ ] **Step 3: Escribir la implementación**

Crear `discord-bot/game-normalize.mjs`:

```js
// Los nombres de actividad de Discord llegan sucios y variables.
// Sin normalizar, un mismo juego aparece como cinco en las tendencias.

const EDITION_SUFFIX = /\s*[:\-]?\s*\b(java|bedrock|deluxe|goty|remastered|definitive|legacy|standard)\b.*$/i;
const TRAILING_EDITION = /\s*\bedition\b.*$/i;

function clean(raw) {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/[   ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(TRAILING_EDITION, "")
    .replace(EDITION_SUFFIX, "")
    .trim();
}

export function displayNameFor(raw) {
  return clean(raw);
}

export function normalizeGameName(raw) {
  return clean(raw).toLowerCase();
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `node --test tests/tierly-game-normalize.test.mjs`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add discord-bot/game-normalize.mjs tests/tierly-game-normalize.test.mjs
git commit -m "feat: normalizar nombres de juego de presence"
```

---

### Task 4: Deltas de presence

**Files:**
- Create: `discord-bot/presence-delta.mjs`
- Test: `tests/tierly-presence-delta.test.mjs`

**Interfaces:**
- Consumes: nada.
- Produces: `playingGames(presence) -> string[]` (nombres crudos de actividades de tipo Playing) y `presenceDelta(oldPresence, newPresence) -> { started: string[], stopped: string[] }`. La Tarea 6 los importa.

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/tierly-presence-delta.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { playingGames, presenceDelta } from "../discord-bot/presence-delta.mjs";

// ActivityType.Playing === 0 en discord.js v14.
const playing = (name) => ({ name, type: 0 });
const streaming = (name) => ({ name, type: 1 });
const listening = (name) => ({ name, type: 2 });
const custom = (name) => ({ name, type: 4 });
const presence = (...activities) => ({ activities });

test("solo considera actividades de tipo Playing", () => {
  const p = presence(playing("Fortnite"), streaming("Twitch"), listening("Spotify"), custom("hola"));
  assert.deepEqual(playingGames(p), ["Fortnite"]);
});

test("presence nula o sin actividades no rompe", () => {
  assert.deepEqual(playingGames(null), []);
  assert.deepEqual(playingGames(presence()), []);
});

test("empezar un juego produce un started", () => {
  const d = presenceDelta(presence(), presence(playing("Valorant")));
  assert.deepEqual(d, { started: ["Valorant"], stopped: [] });
});

test("dejar un juego produce un stopped", () => {
  const d = presenceDelta(presence(playing("Valorant")), presence());
  assert.deepEqual(d, { started: [], stopped: ["Valorant"] });
});

test("cambiar de juego produce ambos", () => {
  const d = presenceDelta(presence(playing("Valorant")), presence(playing("Fortnite")));
  assert.deepEqual(d.started, ["Fortnite"]);
  assert.deepEqual(d.stopped, ["Valorant"]);
});

test("seguir en el mismo juego no produce nada", () => {
  const d = presenceDelta(presence(playing("Fortnite")), presence(playing("Fortnite")));
  assert.deepEqual(d, { started: [], stopped: [] });
});

test("cambiar solo el estado de Spotify no produce nada", () => {
  const before = presence(playing("Fortnite"), listening("cancion A"));
  const after = presence(playing("Fortnite"), listening("cancion B"));
  assert.deepEqual(presenceDelta(before, after), { started: [], stopped: [] });
});

test("oldPresence indefinido trata todo como started", () => {
  const d = presenceDelta(undefined, presence(playing("Rocket League")));
  assert.deepEqual(d, { started: ["Rocket League"], stopped: [] });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `node --test tests/tierly-presence-delta.test.mjs`
Expected: FAIL — no se puede resolver `../discord-bot/presence-delta.mjs`.

- [ ] **Step 3: Escribir la implementación**

Crear `discord-bot/presence-delta.mjs`:

```js
// ActivityType.Playing === 0. Se ignoran Streaming, Listening, Watching,
// Custom Status y Competing: solo "estar jugando" cuenta como sesion.
const PLAYING = 0;

export function playingGames(presence) {
  const activities = presence?.activities;
  if (!Array.isArray(activities)) return [];
  const names = [];
  for (const activity of activities) {
    if (activity?.type !== PLAYING) continue;
    const name = typeof activity.name === "string" ? activity.name.trim() : "";
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

export function presenceDelta(oldPresence, newPresence) {
  const before = playingGames(oldPresence);
  const after = playingGames(newPresence);
  return {
    started: after.filter((name) => !before.includes(name)),
    stopped: before.filter((name) => !after.includes(name)),
  };
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `node --test tests/tierly-presence-delta.test.mjs`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add discord-bot/presence-delta.mjs tests/tierly-presence-delta.test.mjs
git commit -m "feat: calcular deltas de presence de Discord"
```

---

### Task 5: Store de sesiones

**Files:**
- Create: `discord-bot/session-store.mjs`
- Test: `tests/tierly-session-store.test.mjs`

**Interfaces:**
- Consumes: `normalizeGameName`, `displayNameFor` de la Tarea 3.
- Produces: la clase `SessionStore`, construida como `new SessionStore({ supabase, guildId, now })` donde `now` es una función que devuelve `Date` (inyectable para tests). Métodos:
  - `resolveGameId(rawName) -> Promise<number>`
  - `openSession(discordUserId, rawName) -> Promise<void>`
  - `closeSession(discordUserId, rawName, reason) -> Promise<void>`
  - `heartbeat(livePairs) -> Promise<{ kept: number, closed: number }>` donde `livePairs` es un array de `{ discordUserId, gameId }`
  - `closeOrphansOnBoot() -> Promise<number>`

  La Tarea 6 usa exactamente estas firmas.

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/tierly-session-store.test.mjs`. El fake de Supabase registra las llamadas en vez de hablar con la red:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { SessionStore } from "../discord-bot/session-store.mjs";

function fakeSupabase(fixtures = {}) {
  const calls = [];
  const api = {
    calls,
    from(table) {
      const ctx = { table, filters: {} };
      const chain = {
        select() { return chain; },
        eq(col, val) { ctx.filters[col] = val; return chain; },
        is(col, val) { ctx.filters[col] = val; return chain; },
        in(col, val) { ctx.filters[col] = val; return chain; },
        maybeSingle() {
          calls.push({ op: "select", ...ctx });
          return Promise.resolve({ data: fixtures[table] ?? null, error: null });
        },
        insert(values) {
          calls.push({ op: "insert", table, values });
          return {
            select: () => ({
              single: () => Promise.resolve({ data: { id: 42, ...values }, error: null }),
            }),
            then: (res) => res({ data: null, error: null }),
          };
        },
        upsert(values, opts) {
          calls.push({ op: "upsert", table, values, opts });
          return Promise.resolve({ data: null, error: null });
        },
        update(values) {
          calls.push({ op: "update", table, values, filters: ctx.filters });
          const upd = {
            eq(col, val) { ctx.filters[col] = val; return upd; },
            is(col, val) { ctx.filters[col] = val; return upd; },
            in(col, val) { ctx.filters[col] = val; return upd; },
            select: () => Promise.resolve({ data: fixtures.updated ?? [], error: null }),
            then: (res) => res({ data: null, error: null }),
          };
          return upd;
        },
      };
      return chain;
    },
  };
  return api;
}

const FIXED = new Date("2026-09-29T12:00:00Z");
const now = () => FIXED;

test("resuelve un alias existente sin crear juego nuevo", async () => {
  const supabase = fakeSupabase({ game_aliases: { game_id: 7 } });
  const store = new SessionStore({ supabase, guildId: "g1", now });
  const id = await store.resolveGameId("Fortnite");
  assert.equal(id, 7);
  assert.ok(!supabase.calls.some((c) => c.op === "insert" && c.table === "games"));
});

test("crea juego y alias cuando el nombre es nuevo", async () => {
  const supabase = fakeSupabase({ game_aliases: null });
  const store = new SessionStore({ supabase, guildId: "g1", now });
  const id = await store.resolveGameId("  Minecraft: Java Edition ");
  assert.equal(id, 42);
  const gameInsert = supabase.calls.find((c) => c.op === "insert" && c.table === "games");
  assert.equal(gameInsert.values.canonical_name, "minecraft");
  assert.equal(gameInsert.values.display_name, "Minecraft");
  assert.ok(supabase.calls.some((c) => c.op === "insert" && c.table === "game_aliases"));
});

test("abrir sesion inserta la fila y registra al miembro observado", async () => {
  const supabase = fakeSupabase({ game_aliases: { game_id: 7 } });
  const store = new SessionStore({ supabase, guildId: "g1", now });
  await store.openSession("u1", "Fortnite");
  const session = supabase.calls.find((c) => c.op === "insert" && c.table === "play_sessions");
  assert.equal(session.values.guild_id, "g1");
  assert.equal(session.values.discord_user_id, "u1");
  assert.equal(session.values.game_id, 7);
  assert.equal(session.values.ended_at, undefined);
  assert.equal(session.values.last_heartbeat_at, FIXED.toISOString());
  assert.ok(supabase.calls.some((c) => c.op === "upsert" && c.table === "observed_members"));
});

test("cerrar sesion marca ended_at y el motivo", async () => {
  const supabase = fakeSupabase({ game_aliases: { game_id: 7 } });
  const store = new SessionStore({ supabase, guildId: "g1", now });
  await store.closeSession("u1", "Fortnite", "normal");
  const upd = supabase.calls.find((c) => c.op === "update" && c.table === "play_sessions");
  assert.equal(upd.values.closed_reason, "normal");
  assert.equal(upd.values.ended_at, FIXED.toISOString());
});

test("heartbeat cierra con last_heartbeat_at, no con la hora actual", async () => {
  const supabase = fakeSupabase();
  const store = new SessionStore({ supabase, guildId: "g1", now });
  await store.heartbeat([{ discordUserId: "u1", gameId: 7 }]);
  const closing = supabase.calls.find(
    (c) => c.op === "update" && c.table === "play_sessions" && c.values.closed_reason === "heartbeat",
  );
  assert.ok(closing, "el heartbeat debe cerrar las sesiones que ya no estan vivas");
  assert.equal(closing.values.ended_at, undefined, "usa la columna, no una hora calculada");
});

test("al arrancar cierra las sesiones huerfanas como crash", async () => {
  const supabase = fakeSupabase();
  const store = new SessionStore({ supabase, guildId: "g1", now });
  await store.closeOrphansOnBoot();
  const upd = supabase.calls.find((c) => c.op === "update" && c.table === "play_sessions");
  assert.equal(upd.values.closed_reason, "crash");
  assert.equal(upd.filters.guild_id, "g1");
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `node --test tests/tierly-session-store.test.mjs`
Expected: FAIL — no se puede resolver `../discord-bot/session-store.mjs`.

- [ ] **Step 3: Escribir la implementación**

Crear `discord-bot/session-store.mjs`:

```js
import { normalizeGameName, displayNameFor } from "./game-normalize.mjs";

export class SessionStore {
  constructor({ supabase, guildId, now = () => new Date() }) {
    this.supabase = supabase;
    this.guildId = guildId;
    this.now = now;
    this.aliasCache = new Map();
  }

  iso() {
    return this.now().toISOString();
  }

  async resolveGameId(rawName) {
    const canonical = normalizeGameName(rawName);
    if (!canonical) return null;
    if (this.aliasCache.has(canonical)) return this.aliasCache.get(canonical);

    const { data: alias } = await this.supabase
      .from("game_aliases")
      .select("game_id")
      .eq("raw_activity_name", canonical)
      .maybeSingle();

    if (alias?.game_id) {
      this.aliasCache.set(canonical, alias.game_id);
      return alias.game_id;
    }

    const { data: game } = await this.supabase
      .from("games")
      .insert({ canonical_name: canonical, display_name: displayNameFor(rawName) })
      .select()
      .single();

    await this.supabase
      .from("game_aliases")
      .insert({ raw_activity_name: canonical, game_id: game.id });

    this.aliasCache.set(canonical, game.id);
    return game.id;
  }

  async openSession(discordUserId, rawName) {
    const gameId = await this.resolveGameId(rawName);
    if (!gameId) return;
    const stamp = this.iso();

    await this.supabase.from("observed_members").upsert(
      {
        guild_id: this.guildId,
        discord_user_id: discordUserId,
        last_seen_at: stamp,
      },
      { onConflict: "guild_id,discord_user_id" },
    );

    // El indice unico parcial hace que reabrir una sesion ya abierta sea inocuo.
    await this.supabase.from("play_sessions").insert({
      guild_id: this.guildId,
      discord_user_id: discordUserId,
      game_id: gameId,
      started_at: stamp,
      last_heartbeat_at: stamp,
    });
  }

  async closeSession(discordUserId, rawName, reason = "normal") {
    const gameId = await this.resolveGameId(rawName);
    if (!gameId) return;
    await this.supabase
      .from("play_sessions")
      .update({ ended_at: this.iso(), closed_reason: reason })
      .eq("guild_id", this.guildId)
      .eq("discord_user_id", discordUserId)
      .eq("game_id", gameId)
      .is("ended_at", null);
  }

  // livePairs: [{ discordUserId, gameId }] con lo que el bot ve AHORA en su cache.
  async heartbeat(livePairs) {
    const stamp = this.iso();
    const liveKeys = new Set(livePairs.map((p) => `${p.discordUserId}:${p.gameId}`));

    const { data: open } = await this.supabase
      .from("play_sessions")
      .select("id, discord_user_id, game_id")
      .eq("guild_id", this.guildId)
      .is("ended_at", null);

    const rows = Array.isArray(open) ? open : [];
    const aliveIds = [];
    const deadIds = [];
    for (const row of rows) {
      const key = `${row.discord_user_id}:${row.game_id}`;
      (liveKeys.has(key) ? aliveIds : deadIds).push(row.id);
    }

    if (aliveIds.length) {
      await this.supabase
        .from("play_sessions")
        .update({ last_heartbeat_at: stamp })
        .in("id", aliveIds);
    }

    // Se cierra con la columna last_heartbeat_at, no con "ahora": el juego
    // termino en algun punto del intervalo anterior, no recien.
    if (deadIds.length) {
      await this.supabase
        .from("play_sessions")
        .update({ closed_reason: "heartbeat" })
        .in("id", deadIds);
      await this.supabase.rpc("tierly_close_sessions_at_heartbeat", { session_ids: deadIds });
    }

    return { kept: aliveIds.length, closed: deadIds.length };
  }

  async closeOrphansOnBoot() {
    await this.supabase
      .from("play_sessions")
      .update({ closed_reason: "crash" })
      .eq("guild_id", this.guildId)
      .is("ended_at", null);
    await this.supabase.rpc("tierly_close_orphan_sessions", { target_guild: this.guildId });
  }
}
```

Nota: `ended_at = last_heartbeat_at` es una asignación columna-a-columna que PostgREST no expresa desde el cliente JS, por eso las dos RPC (`tierly_close_sessions_at_heartbeat`, `tierly_close_orphan_sessions`). Se definen en la Tarea 7.

- [ ] **Step 4: Agregar `rpc` al fake y correr el test**

El fake de Supabase necesita el método `rpc`. Agregarlo dentro de `api` en el archivo de test:

```js
    rpc(fn, args) {
      calls.push({ op: "rpc", fn, args });
      return Promise.resolve({ data: null, error: null });
    },
```

Run: `node --test tests/tierly-session-store.test.mjs`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add discord-bot/session-store.mjs tests/tierly-session-store.test.mjs
git commit -m "feat: store de sesiones de juego"
```

---

### Task 6: Wiring del bot — intent, handler y heartbeat

**Files:**
- Modify: `discord-bot/index.js` (intents línea ~27-34; agregar handler y loop)
- Modify: `discord-bot/README.md`
- Test: `tests/discord-bot.test.mjs` (agregar bloque)

**Interfaces:**
- Consumes: `presenceDelta`, `playingGames` (Tarea 4); `SessionStore` (Tarea 5).
- Produces: nada que consuman tareas posteriores.

- [ ] **Step 1: Escribir el test que falla**

Agregar a `tests/discord-bot.test.mjs` (el archivo ya lee `discord-bot/index.js` como texto; reusar esa constante de fuente, que se llama según lo que ya exista en el archivo — si se llama distinto, usar el nombre existente):

```js
test("declara el intent de presence", () => {
  assert.match(source, /GatewayIntentBits\.GuildPresences/);
});

test("escucha presenceUpdate y usa el modulo de deltas", () => {
  assert.match(source, /client\.on\(\s*["']presenceUpdate["']/);
  assert.match(source, /presenceDelta/);
});

test("corre un heartbeat de 5 minutos", () => {
  assert.match(source, /HEARTBEAT_INTERVAL_MS\s*=\s*5\s*\*\s*60\s*\*\s*1000/);
  assert.match(source, /setInterval\([^)]*HEARTBEAT_INTERVAL_MS/s);
});

test("cierra sesiones huerfanas y reconcilia al arrancar", () => {
  assert.match(source, /closeOrphansOnBoot/);
  assert.match(source, /reconcile/i);
});

test("sigue sin credenciales hardcodeadas", () => {
  assert.ok(!/SUPABASE_SERVICE_ROLE_KEY\s*=\s*["'][A-Za-z0-9]/.test(source));
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `node --test tests/discord-bot.test.mjs`
Expected: FAIL — falta `GuildPresences`, falta `presenceUpdate`, falta el heartbeat.

- [ ] **Step 3: Agregar el intent**

En `discord-bot/index.js`, en el bloque de intents (~línea 29-32), agregar `GatewayIntentBits.GuildPresences` a la lista. Queda:

```js
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences,
  ],
});
```

- [ ] **Step 4: Cablear el store y el handler de presence**

Cerca de los otros imports en `discord-bot/index.js`:

```js
import { presenceDelta, playingGames } from "./presence-delta.mjs";
import { SessionStore } from "./session-store.mjs";
```

Junto a las otras constantes de intervalo (cerca de `POLL_INTERVAL_MS`, línea ~25):

```js
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;
```

Después de crear el cliente de Supabase:

```js
const sessions = supabase
  ? new SessionStore({ supabase, guildId: DISCORD_GUILD_ID })
  : null;
```

Handler nuevo, junto a los otros `client.on`:

```js
client.on("presenceUpdate", async (oldPresence, newPresence) => {
  if (!sessions) return;
  const guildId = newPresence?.guild?.id ?? oldPresence?.guild?.id;
  if (guildId !== DISCORD_GUILD_ID) return;
  const userId = newPresence?.userId ?? newPresence?.user?.id;
  if (!userId) return;

  const { started, stopped } = presenceDelta(oldPresence, newPresence);
  try {
    for (const game of started) await sessions.openSession(userId, game);
    for (const game of stopped) await sessions.closeSession(userId, game, "normal");
  } catch (error) {
    console.error("[presence] fallo al registrar sesion", error);
  }
});
```

- [ ] **Step 5: Agregar reconciliación y heartbeat al arranque**

Dentro del handler `client.once("ready", ...)` (línea ~166), después de lo que ya hace:

```js
  if (sessions) {
    // Todo lo que quedo abierto de la corrida anterior murio con el proceso.
    await sessions.closeOrphansOnBoot();
    await reconcilePresence();
    setInterval(() => {
      runHeartbeat().catch((error) => console.error("[heartbeat] fallo", error));
    }, HEARTBEAT_INTERVAL_MS);
  }
```

Y las dos funciones, junto a las otras helpers del archivo:

```js
async function livePairsFromCache() {
  const guild = client.guilds.cache.get(DISCORD_GUILD_ID);
  if (!guild) return [];
  const pairs = [];
  for (const member of guild.members.cache.values()) {
    for (const rawName of playingGames(member.presence)) {
      const gameId = await sessions.resolveGameId(rawName);
      if (gameId) pairs.push({ discordUserId: member.id, gameId });
    }
  }
  return pairs;
}

// Sin esto, cada despliegue pierde todo lo que estaba en curso.
async function reconcilePresence() {
  const guild = client.guilds.cache.get(DISCORD_GUILD_ID);
  if (!guild) return;
  for (const member of guild.members.cache.values()) {
    for (const rawName of playingGames(member.presence)) {
      await sessions.openSession(member.id, rawName);
    }
  }
}

async function runHeartbeat() {
  const pairs = await livePairsFromCache();
  const { kept, closed } = await sessions.heartbeat(pairs);
  console.log(`[heartbeat] vivas=${kept} cerradas=${closed}`);
}
```

- [ ] **Step 6: Correr el test para verificar que pasa**

Run: `node --test tests/discord-bot.test.mjs`
Expected: PASS, incluyendo los 5 tests nuevos.

- [ ] **Step 7: Documentar el intent privilegiado**

En `discord-bot/README.md`, en la sección de configuración del bot, agregar:

```markdown
### Intent de presence (obligatorio para V0)

En el Developer Portal de Discord → tu app → Bot → Privileged Gateway Intents,
activar **PRESENCE INTENT** además de SERVER MEMBERS y MESSAGE CONTENT.

Es un intent privilegiado: con menos de 100 servidores se activa sin revisión.
Cada usuario puede ocultar su presence desde su cliente de Discord, así que la
cobertura nunca es del 100% — el panel lo declara explícitamente en vez de
presentar los números como un censo del servidor.
```

- [ ] **Step 8: Commit**

```bash
git add discord-bot/index.js discord-bot/README.md tests/discord-bot.test.mjs
git commit -m "feat: observar presence y mantener sesiones vivas"
```

---

### Task 7: Jobs de agregación, purga y sugerencias

**Files:**
- Create: `supabase/migrations/20260929092000_tierly_v0_jobs.sql`
- Test: `tests/tierly-v0-jobs.test.mjs`

**Interfaces:**
- Consumes: las tablas de la Tarea 1.
- Produces: las funciones `tierly_close_sessions_at_heartbeat(session_ids bigint[])`, `tierly_close_orphan_sessions(target_guild text)`, `tierly_close_stale_sessions()`, `tierly_rollup_day(target_day date)`, `tierly_generate_suggestions()`. La Tarea 5 ya llama a las dos primeras.

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/tierly-v0-jobs.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  new URL("../supabase/migrations/20260929092000_tierly_v0_jobs.sql", import.meta.url),
  "utf8",
);

test("define las funciones que el bot invoca por RPC", () => {
  assert.match(sql, /create or replace function public\.tierly_close_sessions_at_heartbeat/i);
  assert.match(sql, /create or replace function public\.tierly_close_orphan_sessions/i);
});

test("el cierre usa last_heartbeat_at como hora de fin", () => {
  assert.match(sql, /ended_at\s*=\s*last_heartbeat_at/i);
});

test("el rollup aplica el cap de minutos por comunidad", () => {
  assert.match(sql, /least\([^)]*session_cap_minutes/i);
});

test("agrega antes de purgar", () => {
  const rollupPos = sql.search(/insert into public\.daily_game_rollups/i);
  const purgePos = sql.search(/delete from public\.play_sessions/i);
  assert.ok(rollupPos > -1 && purgePos > -1);
  assert.ok(rollupPos < purgePos, "el rollup debe ocurrir antes de la purga");
});

test("las sugerencias respetan el umbral y no duplican pendientes", () => {
  assert.match(sql, /suggestion_threshold/i);
  assert.match(sql, /status\s*=\s*'pending'/i);
  assert.match(sql, /not exists/i);
});

test("programa los jobs con pg_cron", () => {
  assert.match(sql, /cron\.schedule/i);
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `node --test tests/tierly-v0-jobs.test.mjs`
Expected: FAIL con `ENOENT`.

- [ ] **Step 3: Escribir la migración**

Crear `supabase/migrations/20260929092000_tierly_v0_jobs.sql`:

```sql
-- Tierly V0: cierre de sesiones, agregacion diaria, purga y sugerencias.

create extension if not exists pg_cron;

-- El heartbeat marca el motivo desde el cliente; esta funcion pone la hora de
-- fin igual al ultimo latido, que es una asignacion columna-a-columna que
-- PostgREST no puede expresar.
create or replace function public.tierly_close_sessions_at_heartbeat(session_ids bigint[])
returns integer
language sql
security definer
set search_path = public
as $$
  with updated as (
    update public.play_sessions
    set ended_at = last_heartbeat_at
    where id = any(session_ids) and ended_at is null
    returning 1
  )
  select count(*)::int from updated;
$$;

create or replace function public.tierly_close_orphan_sessions(target_guild text)
returns integer
language sql
security definer
set search_path = public
as $$
  with updated as (
    update public.play_sessions
    set ended_at = last_heartbeat_at, closed_reason = 'crash'
    where guild_id = target_guild and ended_at is null
    returning 1
  )
  select count(*)::int from updated;
$$;

-- Red de seguridad: con el heartbeat activo casi nunca se dispara.
create or replace function public.tierly_close_stale_sessions()
returns integer
language sql
security definer
set search_path = public
as $$
  with updated as (
    update public.play_sessions s
    set ended_at = s.last_heartbeat_at, closed_reason = 'timeout'
    from public.communities c
    where c.guild_id = s.guild_id
      and s.ended_at is null
      and s.last_heartbeat_at < now() - make_interval(hours => c.stale_session_hours)
    returning 1
  )
  select count(*)::int from updated;
$$;

-- Agrega el dia indicado y luego purga lo que quedo fuera de retencion.
-- El orden importa: agregar primero, purgar despues.
create or replace function public.tierly_rollup_day(target_day date default (current_date - 1))
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted integer;
begin
  insert into public.daily_game_rollups (guild_id, game_id, day, unique_players, total_minutes, session_count)
  select
    s.guild_id,
    s.game_id,
    target_day,
    count(distinct s.discord_user_id),
    -- El cap evita que una persona con el juego abierto toda la noche
    -- distorsione la tendencia.
    sum(least(s.minutes, c.session_cap_minutes)),
    count(*)
  from public.play_sessions s
  join public.communities c on c.guild_id = s.guild_id
  where s.ended_at is not null
    and s.started_at >= target_day
    and s.started_at < target_day + 1
  group by s.guild_id, s.game_id
  on conflict (guild_id, game_id, day) do update
    set unique_players = excluded.unique_players,
        total_minutes = excluded.total_minutes,
        session_count = excluded.session_count;

  get diagnostics inserted = row_count;

  delete from public.play_sessions s
  using public.communities c
  where c.guild_id = s.guild_id
    and s.ended_at is not null
    and s.started_at < now() - make_interval(days => c.retention_days);

  return inserted;
end;
$$;

create or replace function public.tierly_generate_suggestions()
returns integer
language sql
security definer
set search_path = public
as $$
  with candidates as (
    select
      r.guild_id,
      r.game_id,
      sum(r.unique_players) as players
    from public.daily_game_rollups r
    where r.day >= current_date - 7
    group by r.guild_id, r.game_id
  ),
  eligible as (
    select c.guild_id, c.game_id, c.players
    from candidates c
    join public.communities com on com.guild_id = c.guild_id
    where c.players >= com.suggestion_threshold
      and not exists (
        select 1 from public.suggested_events se
        where se.guild_id = c.guild_id
          and se.game_id = c.game_id
          and se.status = 'pending'
      )
  ),
  inserted as (
    insert into public.suggested_events (guild_id, game_id, window_days, player_count)
    select guild_id, game_id, 7, players from eligible
    returning 1
  )
  select count(*)::int from inserted;
$$;

select cron.schedule(
  'tierly-rollup-diario',
  '15 4 * * *',
  $$select public.tierly_rollup_day();$$
);

select cron.schedule(
  'tierly-cerrar-sesiones-viejas',
  '5 * * * *',
  $$select public.tierly_close_stale_sessions();$$
);

select cron.schedule(
  'tierly-sugerencias',
  '30 4 * * *',
  $$select public.tierly_generate_suggestions();$$
);

revoke all on function public.tierly_close_sessions_at_heartbeat(bigint[]) from public, anon, authenticated;
revoke all on function public.tierly_close_orphan_sessions(text) from public, anon, authenticated;
grant execute on function public.tierly_close_sessions_at_heartbeat(bigint[]) to service_role;
grant execute on function public.tierly_close_orphan_sessions(text) to service_role;
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `node --test tests/tierly-v0-jobs.test.mjs`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260929092000_tierly_v0_jobs.sql tests/tierly-v0-jobs.test.mjs
git commit -m "feat: jobs de rollup, purga y sugerencias"
```

---

### Task 8: Panel de inteligencia

**Files:**
- Modify: `ops/tierly/app.js` (reemplazar las vistas `events`/`tournaments`/`matches`/`rewards`, líneas ~239-330)
- Modify: `ops/tierly/index.html` (agregar cache busting)
- Modify: `ops/tierly/README.md`
- Create: `tests/tierly-insights-ops.test.mjs`

**Interfaces:**
- Consumes: tablas de la Tarea 1; datos poblados por Tareas 6 y 7.
- Produces: nada que consuman tareas posteriores.

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/tierly-insights-ops.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../ops/tierly/app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../ops/tierly/index.html", import.meta.url), "utf8");

test("las vistas son las cuatro de inteligencia", () => {
  for (const view of ["games", "players", "trends", "suggestions"]) {
    assert.match(app, new RegExp(`["']${view}["']`), `falta la vista ${view}`);
  }
});

test("no quedan restos de la gestion de brackets", () => {
  for (const gone of [
    "gaming_tournaments",
    "gaming_matches",
    "gaming_match_participants",
    "gaming_rewards",
    "gaming_events",
  ]) {
    assert.ok(!app.includes(gone), `todavia consulta ${gone}`);
  }
});

test("lee las tablas del modelo V0", () => {
  assert.match(app, /daily_game_rollups/);
  assert.match(app, /suggested_events/);
  assert.match(app, /community_admins/);
});

test("nunca consulta quien jugo a que", () => {
  assert.ok(
    !/from\(["']play_sessions["']\)/.test(app),
    "el panel no lee sesiones per-usuario: solo agregados",
  );
  assert.ok(
    !/discord_user_id/.test(app),
    "el panel no muestra identidades de miembros observados",
  );
});

test("declara la cobertura parcial del presence", () => {
  assert.match(app, /presence visible/i);
});

test("no hay service-role en el panel", () => {
  assert.ok(!/service_role/i.test(app));
});

test("cache busting coherente entre app.js y styles.css", () => {
  const js = html.match(/app\.js\?v=([\w-]+)/);
  const css = html.match(/styles\.css\?v=([\w-]+)/);
  assert.ok(js, "app.js necesita ?v=");
  assert.ok(css, "styles.css necesita ?v=");
  assert.equal(js[1], css[1], "ambas versiones deben coincidir");
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `node --test tests/tierly-insights-ops.test.mjs`
Expected: FAIL — las vistas viejas siguen, falta el cache busting.

- [ ] **Step 3: Reemplazar el estado y las vistas en `ops/tierly/app.js`**

Dentro del IIFE existente, reemplazar el objeto `state` (líneas ~11-22) y todo el bloque `renderView()` (líneas ~239-330) por:

```js
  const state = {
    session: null,
    guilds: [],
    guildId: null,
    view: "games",
    loading: false,
    error: null,
    data: { games: [], players: [], trends: [], suggestions: [], coverage: null },
  };

  const VIEWS = [
    { id: "games", label: "Juegos activos" },
    { id: "players", label: "Jugadores únicos" },
    { id: "trends", label: "Tendencias" },
    { id: "suggestions", label: "Eventos sugeridos" },
  ];

  // La RLS ya filtra por membresia; el front solo pide lo que le corresponde.
  async function loadGuilds() {
    const { data, error } = await supabase
      .from("community_admins")
      .select("guild_id, role, communities(name, icon_url)");
    if (error) throw error;
    state.guilds = data ?? [];
    if (!state.guildId && state.guilds.length) state.guildId = state.guilds[0].guild_id;
  }

  function sinceDays(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  }

  async function loadGames(days) {
    const { data, error } = await supabase
      .from("daily_game_rollups")
      .select("game_id, unique_players, total_minutes, session_count, games(display_name)")
      .eq("guild_id", state.guildId)
      .gte("day", sinceDays(days));
    if (error) throw error;
    const byGame = new Map();
    for (const row of data ?? []) {
      const key = row.game_id;
      const acc = byGame.get(key) ?? {
        name: row.games?.display_name ?? "Desconocido",
        players: 0,
        minutes: 0,
        sessions: 0,
      };
      acc.players += row.unique_players;
      acc.minutes += row.total_minutes;
      acc.sessions += row.session_count;
      byGame.set(key, acc);
    }
    return [...byGame.values()].sort((a, b) => b.players - a.players);
  }

  async function loadSuggestions() {
    const { data, error } = await supabase
      .from("suggested_events")
      .select("id, player_count, window_days, status, generated_at, games(display_name)")
      .eq("guild_id", state.guildId)
      .eq("status", "pending")
      .order("player_count", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  function emptyState(message) {
    return `<p class="empty">${message}</p>`;
  }

  function renderGames() {
    const rows = state.data.games;
    if (!rows.length) {
      return emptyState(
        "Todavía no hay datos. A medida que la comunidad juegue, acá vas a ver qué juegos concentran más gente en los últimos 7 y 30 días.",
      );
    }
    return `
      <table class="grid">
        <thead><tr><th>Juego</th><th>Jugadores</th><th>Horas</th><th>Sesiones</th></tr></thead>
        <tbody>
          ${rows
            .map(
              (g) =>
                `<tr><td>${g.name}</td><td>${g.players}</td><td>${Math.round(g.minutes / 60)}</td><td>${g.sessions}</td></tr>`,
            )
            .join("")}
        </tbody>
      </table>`;
  }

  function renderPlayers() {
    const c = state.data.coverage;
    if (!c) {
      return emptyState(
        "Todavía no hay datos. Acá vas a ver cuánta gente distinta aparece por semana.",
      );
    }
    return `
      <p class="metric">${c.unique} jugadores únicos esta semana</p>
      <p class="note">${c.observed} miembros tienen presence visible. Quien lo oculta no aparece en estos números: esto no es un censo del servidor.</p>`;
  }

  function renderTrends() {
    const rows = state.data.trends;
    if (!rows.length) {
      return emptyState(
        "Hacen falta al menos dos semanas de datos para comparar. Acá vas a ver qué juegos suben y cuáles bajan.",
      );
    }
    return `
      <ul class="trends">
        ${rows
          .map(
            (t) =>
              `<li>${t.name} <strong>${t.delta > 0 ? "+" : ""}${t.delta}</strong> jugadores vs. semana previa</li>`,
          )
          .join("")}
      </ul>`;
  }

  function renderSuggestions() {
    const rows = state.data.suggestions;
    if (!rows.length) {
      return emptyState(
        "Sin sugerencias por ahora. Cuando varios miembros coincidan en un mismo juego, Tierly te lo propone acá.",
      );
    }
    return rows
      .map(
        (s) => `
        <article class="suggestion" data-id="${s.id}">
          <h3>${s.player_count} miembros jugaron ${s.games?.display_name ?? "este juego"} esta semana</h3>
          <p>¿Creamos una noche de ${s.games?.display_name ?? "este juego"}?</p>
          <div class="actions">
            <button data-action="accept" data-id="${s.id}">Aceptar</button>
            <button data-action="dismiss" data-id="${s.id}">Descartar</button>
          </div>
        </article>`,
      )
      .join("");
  }

  function renderView() {
    switch (state.view) {
      case "players":
        return renderPlayers();
      case "trends":
        return renderTrends();
      case "suggestions":
        return renderSuggestions();
      case "games":
      default:
        return renderGames();
    }
  }
```

En el handler de acciones de sugerencias, "aceptar" solo cambia el estado y ofrece el texto para copiar — la creación real del evento es V1:

```js
  async function updateSuggestion(id, status) {
    const { error } = await supabase
      .from("suggested_events")
      .update({ status })
      .eq("id", id);
    if (error) throw error;
    state.data.suggestions = await loadSuggestions();
    render();
  }
```

- [ ] **Step 4: Borrar el resto del código de brackets**

Eliminar de `ops/tierly/app.js` todas las funciones y queries que referencian `gaming_events`, `gaming_tournaments`, `gaming_matches`, `gaming_match_participants` y `gaming_rewards` (las del rango ~línea 81-195 del archivo original), más la invocación de la edge function `luma-events` si ya no la usa ninguna vista. Verificar:

```bash
rg -n "gaming_(events|tournaments|matches|match_participants|rewards)" ops/tierly/app.js
```

Expected: sin resultados.

- [ ] **Step 5: Agregar cache busting en `ops/tierly/index.html`**

Cambiar las referencias a assets para que ambas usen la MISMA versión:

```html
<link rel="stylesheet" href="./styles.css?v=20260929-01" />
<script src="./app.js?v=20260929-01"></script>
```

- [ ] **Step 6: Correr el test para verificar que pasa**

Run: `node --test tests/tierly-insights-ops.test.mjs`
Expected: PASS, 7 tests.

- [ ] **Step 7: Actualizar el README del panel**

En `ops/tierly/README.md`, reemplazar la descripción de gestión de torneos por:

```markdown
Panel de inteligencia de Tierly V0. Muestra, por comunidad y siempre en forma
agregada: juegos activos, jugadores únicos, tendencias semanales y eventos
sugeridos.

El panel nunca muestra quién jugó a qué — solo conteos. La lista nominal de a
quién invitar llega en V1, junto con un flujo de consentimiento.

Bump del cache busting: `app.js` y `styles.css` se referencian con `?v=` en
`index.html` y ambos valores deben coincidir; `tests/tierly-insights-ops.test.mjs`
falla si difieren.
```

- [ ] **Step 8: Commit**

```bash
git add ops/tierly/app.js ops/tierly/index.html ops/tierly/README.md tests/tierly-insights-ops.test.mjs
git commit -m "feat: panel de inteligencia de comunidad"
```

---

### Task 9: Limpieza del frontend público y de los tests obsoletos

**Files:**
- Modify: `tierly/app.js` (quitar leaderboard, tiers y bracket)
- Modify: `tierly/index.html` (quitar secciones correspondientes, bump `?v=`)
- Modify: `discord-bot/index.js` (quitar el poll de anuncios y rank-ups)
- Delete: `tierly/ranks.mjs`, `tests/leaderboard-ranks.test.mjs`, `tests/leaderboard-points.test.mjs`, `tests/leaderboard-ops.test.mjs`
- Test: correr la suite completa

**Interfaces:**
- Consumes: el estado del repo tras la Tarea 8.
- Produces: una suite verde.

- [ ] **Step 1: Confirmar quién importa lo que se va a borrar**

```bash
rg -n "ranks\.mjs|rankForPoints|GAMING_RANKS|leaderboard_public_view|event_bracket_public_view|gaming_rewards_public_view|gaming_events_catalog_public_view" --glob '!docs/**'
```

Anotar cada resultado: son exactamente los puntos a editar en los pasos siguientes. `discord-bot/index.js:3` importa `../tierly/ranks.mjs` — ese import y las funciones `announceRankUps` / `announceNewEvents` / `runNotificationPoll` que lo usan salen en el Step 3.

- [ ] **Step 2: Quitar del frontend público las superficies retiradas**

En `tierly/app.js`, eliminar las funciones y bloques de render que consultan `leaderboard_public_view` (líneas ~539, 551, 1604), `event_bracket_public_view` (~669), `gaming_events_catalog_public_view` (~674), `gaming_rewards_public_view` (~697) y la RPC `tierly_seed_bracket` (~816). En `tierly/index.html`, eliminar las secciones de ranking, tiers, bracket y rewards que quedan sin datos, y subir el cache busting de `?v=20260925-25` a `?v=20260929-01` en las dos referencias (líneas ~1013-1014).

Racer y Chess NO se tocan: siguen funcionando sobre `gaming_players` y `gaming_match_participants`, que sobreviven.

- [ ] **Step 3: Quitar del bot el poll de anuncios y rank-ups**

En `discord-bot/index.js`: borrar el import de `../tierly/ranks.mjs` (línea 3), las funciones `runNotificationPoll`, `announceNewEvents` y `announceRankUps`, la constante `POLL_INTERVAL_MS` (línea ~25) y el `setInterval` del poll dentro de `ready`. Consultaban `gaming_events` y `gaming_bot_notifications`, que ya no existen desde la Tarea 2.

El heartbeat de la Tarea 6 se queda: es otro `setInterval`, con su propia constante.

- [ ] **Step 4: Borrar los módulos y tests obsoletos**

```bash
git rm tierly/ranks.mjs tests/leaderboard-ranks.test.mjs tests/leaderboard-points.test.mjs tests/leaderboard-ops.test.mjs
```

`tests/leaderboard-ops.test.mjs` valida RLS sobre la migración original de brackets, que ya no aplica; su rol lo cumple ahora `tests/tierly-v0-schema.test.mjs`. `tierly/points.mjs` se borra solo si `rg -n "points.mjs" ` no devuelve consumidores vivos; si Racer o Chess lo usan, se conserva.

- [ ] **Step 5: Correr la suite completa**

Run: `npm test`
Expected: PASS en todos los archivos. Si `tests/tierly-chess.test.mjs` o `tests/tierly-racer.test.mjs` fallan, es porque afirmaban algo sobre secciones de `tierly/index.html` que se borraron: ajustar esas aserciones al HTML nuevo, sin tocar la lógica de chess ni de racer.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: retirar leaderboard publico, tiers y anuncios del bot"
```

---

### Task 10: Verificación de extremo a extremo

**Files:**
- Modify: `NEXT_SESSION.md`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: confirmación de que V0 funciona contra datos reales.

- [ ] **Step 1: Aplicar las migraciones**

```bash
supabase db push
```

Expected: las tres migraciones nuevas aplican sin error. Si `pg_cron` no está disponible en el proyecto, habilitarlo desde el dashboard de Supabase (Database → Extensions) antes de reintentar.

- [ ] **Step 2: Sembrar la comunidad**

Con el `DISCORD_GUILD_ID` real y el `user_id` de tu cuenta en `auth.users`:

```sql
insert into public.communities (guild_id, name)
values ('<DISCORD_GUILD_ID>', 'Tellus Cooperative')
on conflict (guild_id) do nothing;

insert into public.community_admins (guild_id, user_id, role)
values ('<DISCORD_GUILD_ID>', '<TU_AUTH_USER_ID>', 'owner')
on conflict do nothing;
```

- [ ] **Step 3: Activar el intent y arrancar el bot**

Activar PRESENCE INTENT en el Developer Portal (ver `discord-bot/README.md`), después:

```bash
cd discord-bot && npm start
```

Expected: el bot conecta y loguea `[heartbeat] vivas=N cerradas=M` a los 5 minutos.

- [ ] **Step 4: Verificar que las sesiones se abren y se cierran**

Abrir un juego en Discord con presence visible, esperar, cerrarlo, esperar un ciclo de heartbeat. Después:

```sql
select discord_user_id, game_id, started_at, ended_at, closed_reason, minutes
from public.play_sessions
order by started_at desc
limit 10;
```

Expected: una fila con `ended_at` no nulo, `closed_reason` en `normal` o `heartbeat`, y `minutes` coherente con el tiempo real jugado.

- [ ] **Step 5: Verificar rollups y sugerencias**

```sql
select public.tierly_rollup_day(current_date);
select * from public.daily_game_rollups order by day desc limit 10;
select public.tierly_generate_suggestions();
select * from public.suggested_events order by generated_at desc limit 10;
```

Expected: rollups con `unique_players` y `total_minutes` coherentes. Las sugerencias aparecen solo si algún juego superó el umbral de 5 jugadores únicos en 7 días — con datos de prueba de una sola persona, lo esperable es cero filas.

- [ ] **Step 6: Verificar el panel**

```bash
npm run dev
```

Abrir `http://localhost:8080/ops/tierly/`, entrar con la cuenta admin. Expected: las cuatro vistas cargan; con pocos datos se ven los estados vacíos explicativos, no ceros ni errores.

- [ ] **Step 7: Verificar el aislamiento de la RLS**

Con un usuario autenticado que NO esté en `community_admins`:

```sql
select count(*) from public.daily_game_rollups;
```

Expected: 0 filas. Si devuelve datos, la RLS está mal y hay que parar y arreglarla antes de seguir.

- [ ] **Step 8: Actualizar `NEXT_SESSION.md` y commitear**

Anotar el estado de V0, lo verificado y lo que queda para V1 (crear eventos reales desde las sugerencias, consentimiento para listas nominales).

```bash
git add NEXT_SESSION.md
git commit -m "docs: estado de Tierly V0 verificado"
```
