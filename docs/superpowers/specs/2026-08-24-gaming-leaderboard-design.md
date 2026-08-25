# Leaderboard Gaming — Diseño

Estado: aprobado, pendiente plan de implementación
Fecha: 2026-08-24

## Problema

Tellus compró una consola y corre torneos estilo Mario Kart / Smash en
eventos presenciales Web2 + Web3, con premios (Ledger, poleras, etc).
Hoy no hay forma de llevar un leaderboard que cruce eventos, verificar
que un jugador sea miembro del Discord de Tellus, ni dejar un registro
a prueba de manipulación de los resultados. Todo es a mano (alguien se
acuerda de quién ganó).

## Objetivos

- Página pública `/leaderboard`: ranking acumulado cruzando eventos, no
  solo el bracket de un torneo suelto.
- El login con Discord habilita las funciones ligadas a participación;
  la membresía en el guild de Discord de Tellus se verifica del lado
  servidor.
- El staff puede correr un torneo desde una tablet en el evento
  (inscripción walk-in) y los jugadores también pueden pre-inscribirse
  online si quieren.
- El admin puede cargar resultados de partidas (rondas de eliminación o
  heats multi-jugador) y el leaderboard acumulado se actualiza solo.
- Los premios (rewards) se trackean por jugador/torneo.
- Más adelante: los resultados quedan anclados on-chain (Stellar,
  custodiado por Tellus) como registro público verificable, y el
  standing se postea a un canal de Discord.

## No-objetivos (esta fase)

- Sin wallets de jugador. El anclaje on-chain (fase 3) es custodiado —
  ningún jugador necesita tener ni conectar una wallet Stellar.
- Sin bot de Discord con proceso persistente. Este repo es 100%
  estático + serverless (Vercel); nada acá corre una conexión de
  gateway 24/7. Donde el pedido original habla de "un bot", se
  implementa como el bot token de una Discord Application usado solo
  para llamadas REST salientes desde una Supabase Edge Function —
  nunca un cliente corriendo.
- Sin tienda de canje de puntos. Los premios los asigna el admin por
  resultado de torneo, no se compran con puntos acumulados.
- Sin slash commands / interacciones dentro de Discord en esta fase.
  Se podría sumar después como una función stateless de Interactions
  endpoint; fuera de alcance ahora.

## Fases

1. **Core** (este spec, detalle completo): modelo de datos, leaderboard
   público, panel admin, login Discord + verificación de membresía.
2. Posts del bot a Discord (standings en vivo a un canal) + pulido de
   UI de premios. Spec propio cuando la fase 1 esté en producción.
3. Anclaje on-chain (Stellar, custodiado). Spec propio cuando la fase 2
   esté en producción.

Cada fase se puede shippear sola. El esquema de la fase 1 está pensado
para que 2 y 3 sumen columnas/tablas en vez de reformar las que ya
existen.

## Modelo de datos

Tablas nuevas en Supabase, mismo proyecto (`rhzanxzoqmbxptvxgnfj`),
mismo esquema de RLS que ya usa el repo (escritura de admin acotada por
`organization_members`, ver
`supabase/migrations/20260716220000_add_program_participants.sql` y
`20260819090000_create_qr_codes.sql`). La página pública necesita
lectura anónima, algo que ninguna tabla existente permite hoy — eso es
nuevo para esta feature, resuelto con una vista pública acotada en vez
de abrir las tablas base a `anon`.

- `gaming_players`
  - `id uuid pk`, `discord_id text unique not null`, `display_name
    text`, `avatar_url text`, `stellar_address text null` (sin uso
    hasta la fase 3), `created_at`, `updated_at`
  - La fila se crea/actualiza (upsert por `discord_id`) en el primer
    login con Discord.
- `gaming_events`
  - `id uuid pk`, `organization_id`, `name text`, `event_date date`,
    `location text`, `created_at`
- `gaming_tournaments`
  - `id uuid pk`, `event_id fk`, `game text` (ej. "Mario Kart 8"),
    `format text check in ('elimination','heats')`, `status text check
    in ('draft','live','completed')`, `created_at`
- `gaming_matches`
  - `id uuid pk`, `tournament_id fk`, `round int null` (solo
    eliminación), `next_match_id uuid null fk self` (solo eliminación —
    el ganador pasa solo a esta ranura), `status text check in
    ('pending','live','confirmed')`, `confirmed_by uuid fk
    auth.users`, `confirmed_at`
- `gaming_match_participants`
  - `id uuid pk`, `match_id fk`, `player_id fk`, `placement int not
    null` (1 = ganador/1er puesto, sirve tanto para una partida 1v1 de
    eliminación como para un heat de 8 corredores), `points_awarded
    int not null default 0`
  - unique (`match_id`, `player_id`)
- `gaming_scores`
  - `player_id fk pk`, `total_points int not null default 0`,
    `updated_at`
  - No se edita a mano. Se recalcula con un trigger cuando una partida
    pasa a `confirmed`, mismo patrón que `apply_ambassador_rank()` /
    `sync_event_attendance_to_participant()` en
    `20260716225500_automate_ambassador_ranks.sql` — una función
    trigger `security definer`, `set search_path = ''` que suma
    `points_awarded` de las partidas confirmadas dentro de
    `gaming_scores`. Fórmula default (configurable por admin más
    adelante, constante fija en la fase 1): puesto 1 → 10 pts, 2 → 6,
    3 → 3, participación → 1.
- `gaming_rewards`
  - `id uuid pk`, `player_id fk`, `tournament_id fk`, `description
    text` (ej. "Ledger Nano", "Poleron Tellus"), `fulfilled bool not
    null default false`, `fulfilled_at`, `created_by uuid fk
    auth.users`

RLS:
- Tablas base: `select`/`all` restringido a miembros `authenticated` de
  la org vía `organization_members`, igual que las tablas de ops que ya
  existen — ahí es donde lee/escribe el panel admin.
- `public.leaderboard_public_view` (y `event_bracket_public_view`):
  vista que solo expone `display_name`, `avatar_url`, `total_points`,
  posiciones de torneo/partida — sin `discord_id`, sin email, sin ids
  internos más allá de lo necesario para linkear. `grant select on
  estas vistas to anon, authenticated`. Es la única superficie de
  lectura anónima — las tablas base quedan cerradas a `anon`.

## Página pública — `/leaderboard`

`leaderboard/index.html` nuevo, con su rewrite agregado a
`vercel.json` (mismo esquema que `/hub`). No requiere login para ver.
Secciones:
- Ranking general cruzando eventos (desde `leaderboard_public_view`).
- Bracket o standings en vivo del evento actual/más reciente.
- Galería de ganadores + premios entregados (desde `gaming_rewards`
  cruzado con la vista pública).
- "Iniciar sesión con Discord" — solo habilita ver tu propio historial
  vinculado; ver el leaderboard en sí nunca lo requiere.
- Bilingüe vía el diccionario existente `i18n.js` (`en`/`es`),
  consistente con el resto del sitio.

## Admin — `ops/leaderboard/`

Mismo molde que `ops/stellar/` y `ops/social/`: JS vanilla IIFE,
`supabase-js` desde CDN, mismo allowlist de master admins / convención
de first-access, su propio `config.js` con la URL pública de Supabase +
publishable key, cache-busting `?v=YYYYMMDD-NN` en
`app.js`/`styles.css` (los tests exigen que ambas versiones coincidan,
igual que `tests/stellar-ops.test.mjs`).

Capacidades: crear eventos/torneos, anotar jugadores walk-in o
pre-inscriptos en un torneo, correr partidas (confirmar posiciones —
esto pasa `gaming_matches.status` a `confirmed` y el trigger de
puntajes recalcula `gaming_scores`), asignar/marcar premios como
entregados.

## Integración con Discord

- **Login**: proveedor Discord OAuth nativo de Supabase Auth
  (habilitado desde el dashboard de Supabase, no en código) — mismo
  mecanismo ya documentado para el allowlist de redirect URLs en
  `ops/stellar/README.md`. Agregar
  `https://telluscoop.org/leaderboard` a la lista de redirects
  permitidos. En el primer login, se hace upsert de `gaming_players`
  con el perfil de Discord.
- **Verificación de membresía**: una Supabase Edge Function nueva
  (`supabase/functions/discord-verify`, hermana de `luma-events`)
  guarda `DISCORD_BOT_TOKEN` y `DISCORD_GUILD_ID` como secrets de
  Supabase — nunca en código frontend. Llama a `GET
  /guilds/{guild_id}/members/{user_id}` con el bot token del lado
  servidor y devuelve un booleano. Esto requiere registrar una Discord
  Application con un bot agregado al guild de Tellus (el bot nunca se
  conecta al gateway — es solo un credential para llamadas REST).
- **"El bot muestra quién va ganando"**: cuando el admin confirma una
  partida (fase 2, no fase 1), la misma Edge Function o una hermana
  hace un `POST` con un embed a un Incoming Webhook de Discord
  (secret `DISCORD_WEBHOOK_URL`) con el top-N actual. Sin proceso de
  bot, sin gateway, solo una llamada de webhook saliente disparada por
  la acción del admin.

## Anclaje on-chain (boceto fase 3)

Cuenta Stellar custodiada por Tellus. Cuando el admin confirma un
resultado, ya con fase 1/2 en producción, una llamada del lado
servidor escribe un registro compacto (id de torneo, id de partida,
hash de las posiciones) ya sea como entrada `manageData` o vía un
contrato Soroban mínimo de registro — a definir en el spec propio de
esa fase, una vez que 1/2 estén corriendo y se conozca el volumen real
de transacciones. La página pública muestra un link "verificado
on-chain ✅" al Stellar Explorer por cada resultado confirmado. Ningún
jugador necesita wallet en ningún momento.

## Testing

Siguiendo la convención del repo (asserts estáticos contra el código
fuente, no tests de runtime — ver `tests/stellar-ops.test.mjs`,
`tests/social-ops.test.mjs`):
- `tests/leaderboard-ops.test.mjs` — verifica que las versiones de
  cache-busting de `ops/leaderboard/app.js` e `index.html` coincidan,
  y que los flujos clave de admin existan en el código fuente.
- `tests/leaderboard-public.test.mjs` — verifica que la página pública
  renderice las secciones esperadas y que `vercel.json` tenga el
  rewrite de `/leaderboard`.
- Un test unitario plano con `node:test` para la fórmula de puntos
  (función pura, no necesita Supabase) — la única lógica real que vale
  la pena testear aislada.

## Manejo de errores

- Si la verificación de membresía de Discord falla o pega rate limit →
  se trata como "no verificado", se muestra un CTA de reintentar,
  nunca se otorga acceso en silencio.
- Confirmar una partida es la única escritura que dispara varias cosas
  (trigger de puntaje, más adelante: post a webhook, anclaje
  on-chain) — cada paso debe ser reintentable/idempotente de forma
  independiente (constraints unique evitan puntuar dos veces la misma
  partida; las llamadas de webhook/anclaje se indexan por id de
  partida para que un reintento no duplique el post ni el anclaje).
- Las escrituras del panel admin quedan forzadas por RLS igual que en
  `ops/stellar` — una cuenta con rol `viewer` o revocada recibe un 403
  de Postgres, no un no-op silencioso.

## Secrets (solo como secrets de Supabase Edge Functions — nunca en frontend/env dentro del repo)

- `DISCORD_BOT_TOKEN`
- `DISCORD_GUILD_ID`
- `DISCORD_WEBHOOK_URL` (fase 2)
- Clave de firma custodiada de Stellar (fase 3)

## Riesgos abiertos

- Rate limits de la API de Discord en el endpoint de verificación de
  membresía durante picos de tráfico el día del evento — mitigar con
  un caché de TTL corto del resultado de verificación en
  `gaming_players`.
- La fórmula de puntos default es una estimación; hace falta un valor
  real de Tellus antes de que se sienta "definitiva" — se shippea como
  constante ajustable por admin para que no sea un bloqueante.
