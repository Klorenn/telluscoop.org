# Leaderboard Ops

Panel admin del leaderboard gaming de Tellus. Sigue el mismo molde que
`ops/stellar/` — vanilla JS + Supabase, mismo proyecto (`rhzanxzoqmbxptvxgnfj`),
autorización 100% vía RLS/`organization_members` (sin allowlist propio: cualquier
cuenta que ya tiene rol `admin`/`operator`/`finance` en la org Tellus puede
administrar el leaderboard).

## Setup local

`npm run dev` → `http://localhost:8080/ops/leaderboard/?preview=1` para una
vista sin datos reales. `http://localhost:8080/ops/leaderboard/` (sin query)
usa Supabase Auth real — necesitás una cuenta con rol no-`viewer` en la org.

## Setup de producción (pasos manuales, una sola vez)

1. **Aplicar la migración** `supabase/migrations/20260825120000_create_gaming_leaderboard.sql`
   al proyecto `rhzanxzoqmbxptvxgnfj` (CLI o SQL editor del dashboard).
2. **Registrar una Discord Application**: https://discord.com/developers/applications
   → crear app → agregar un Bot → copiar el **bot token** → invitar el bot al
   guild de Tellus con permiso mínimo `View Channels`/`Guild Members Intent`
   habilitado (Bot no se conecta nunca al gateway — solo se usa el token para
   llamadas REST salientes desde `discord-verify`).
3. **Habilitar el provider Discord OAuth** en el dashboard de Supabase (Auth →
   Providers → Discord), usando el client id/secret de la misma Discord
   Application.
4. **Agregar la redirect URL** `https://telluscoop.org/leaderboard` a la
   allowlist de Auth (Auth → URL Configuration → Redirect URLs) — mismo lugar
   donde ya está `https://telluscoop.org/ops/stellar/`.
5. **Configurar secrets del Edge Function** (nunca en `config.js`/`.env.local`/git):
   ```bash
   supabase secrets set DISCORD_BOT_TOKEN=... DISCORD_GUILD_ID=... --project-ref rhzanxzoqmbxptvxgnfj
   ```
6. **Deployar la función**:
   ```bash
   supabase functions deploy discord-verify --project-ref rhzanxzoqmbxptvxgnfj
   ```

## Seguridad

- Cada tabla `gaming_*` tiene RLS; lectura/escritura de staff acotada por
  `organization_members`, igual que `ops/stellar`.
- La única superficie anónima son las vistas `leaderboard_public_view`,
  `event_bracket_public_view`, `gaming_rewards_public_view` — las tablas base
  quedan cerradas a `anon`.
- `discord-verify` nunca confía en membresía enviada por el cliente — siempre
  vuelve a pegarle a la API de Discord con el bot token del lado servidor
  (con cache de 10 minutos en `gaming_players.discord_verified_at` para
  absorber picos de tráfico el día del evento).
