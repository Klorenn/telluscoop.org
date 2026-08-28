# Tierly — qué falta, qué arreglar, qué mejorar

Estado a 2026-08-27. Basado en código actual (`tierly/app.js`, `tierly/index.html`) + `NEXT_SESSION.md`.

## 1. Bugs conocidos (arreglar ya)

- **Búsqueda de Passport builders no funciona** — acción `builders` en `passport-profile` no devuelve resultados en `#lb-passport-results`. Verificar si el edge function deployado es el actual.
- **Edge functions sin deployar**: `passport-profile` (normalización + stats/socials/top_repos) y `discord-verify` (manejo de error 500) tienen cambios locales sin `supabase functions deploy`.
- **Identidad de jugador frágil**: el jugador logueado se matchea por `display_name` (trim+lowercase) contra el nombre de Discord, no por `player_id`/`discord_id`. Dos usuarios con el mismo display name colisionan. `leaderboard_public_view`/`event_bracket_public_view` deberían exponer un ID estable.
- **Link de Passport mal ubicado** — hoy vive en el leaderboard, debería estar en la vista Perfil.
- **`pointsForPlacement()` duplicado a mano** en `app.js` porque `points.mjs` no se carga como script — riesgo de que las dos copias diverjan silenciosamente. Mismo problema con `GAMING_TIERS`/`ranks.mjs`.

## 2. Features del mockup que no se pueden hacer con el dato actual

Bloqueadas porque las vistas públicas de Supabase no exponen esos campos:

- Racha / streak real (hoy `renderProfileStreak` es best-effort sobre lo que hay)
- Logros / achievements
- Editar perfil (bio, avatar) — hoy solo hay banner picker vía localStorage, no persiste al backend
- "Miembro desde" (fecha de alta)

**Para desbloquear**: agregar columnas/vistas (`created_at`, tabla de achievements, `player_id` estable) — ya hay migraciones recientes (`add_username_bio_to_players`, `sync_passport_profile_snapshot`) que muestran el patrón a seguir.

## 3. Huecos funcionales frente a apps comparables

Tierly hoy es: leaderboard + tiers/rangos + bracket del último evento + rewards en lista + perfil con stats + búsqueda de Passport builders + settings (idioma/tema).

| Feature | Tierly hoy | Duolingo (leagues/streak) | Discord bots (MEE6/Arcane) | Guild.xyz / Galxe / Layer3 |
|---|---|---|---|---|
| Ranking por puntos | ✅ (top 50 + búsqueda) | ✅ | ✅ | ✅ |
| Tiers con divisiones | ✅ (Bronce→Diamante, 3 divisiones c/u) | ✅ (ligas semanales) | ✅ (niveles) | ✅ (roles/badges) |
| Historial de partidas | ✅ solo último evento, lista plana | ✅ historial completo con fecha | ➖ | ➖ |
| Rachas / streaks | ❌ bloqueado por dato | ✅ core del producto | ➖ | ➖ |
| Logros / badges | ❌ | ✅ | ✅ (roles automáticos) | ✅ (quests → badge on-chain) |
| Notificaciones (nuevo evento, subiste de rango) | ❌ | ✅ push/email | ✅ (mensaje en canal) | ✅ (email/Discord webhook) |
| Editar perfil propio | ❌ (solo banner local) | ✅ | ➖ | ✅ |
| Temporadas / reset periódico de ranking | ❌ (ranking acumulativo sin fin) | ✅ (liga semanal, reset) | ➖ | ✅ (season points) |
| Comparar contra amigos / filtro por servidor-grupo | ❌ | ✅ (liga con N usuarios) | ➖ | ➖ |
| Perfil público compartible (`/tierly/u/:username`) | ✅ | ➖ | ➖ | ✅ |
| Búsqueda de cualquier jugador (no solo top 50) | ✅ (implementado esta sesión) | ➖ | ➖ | ➖ |
| Multi-idioma | ✅ (en/es) | ✅ | ❌ (bot en 1 idioma típicamente) | ✅ |
| Panel admin para cargar eventos/premios | ❓ no visible en `tierly/` (¿vive en `ops/tierly/`? confirmar) | N/A | ✅ (dashboard) | ✅ (dashboard) |

### Gaps que más pesan (por impacto vs esfuerzo)

1. **Notificaciones de cambio de estado** (subiste de rango, nuevo evento, resultado publicado) — hoy el usuario tiene que entrar a mirar. Máximo impacto en retención, bajo esfuerzo si ya existe el bot de Discord (`discord-bot/`) — se le puede sumar un webhook.
2. **Historial completo de partidas en perfil**, no solo "último evento" — hoy `renderLatestBracket`/`renderProfileHistory` están acotados, y no hay paginación ni filtro por fecha/juego.
3. **Temporadas**: sin reset, el ranking se vuelve estático — top 5 no cambia nunca y desincentiva a nuevos jugadores. Esto es lo que hace fuerte a Duolingo (competencia de corto plazo, siempre alcanzable).
4. **Editar perfil real** (bio, avatar propio, no solo banner de galería) — mockup ya lo pedía, falta el dato/endpoint.
5. **Player ID estable** — deuda técnica que bloquea casi todo lo anterior (notificaciones, historial correcto, streak).

## 4. Mejoras de UX/UI menores

- `renderLatestBracket`/`loadRewards` renderizan listas `<ul><li>` planas sin estilo de tarjeta — inconsistente con el resto del perfil que sí tiene tarjetas (`lb-profile-card`).
- Banner picker tiene ~50 opciones hardcodeadas en un array en `app.js` (`PROFILE_BANNERS`) — no viene de Supabase Storage, así que agregar/quitar banners requiere deploy de código.
- Sin loading skeletons — las vistas muestran vacío hasta que resuelve la query (` t("empty")` se ve como "sin resultados" incluso mientras carga).
- Sin manejo de error visible al usuario si falla una query (todo colapsa a `[]` silenciosamente, buen patrón para no romper la UI pero mal para debug/UX si Supabase está caído).

## 5. Deuda técnica

- Sin bundler/TS — funciona para el tamaño actual, pero `app.js` ya es grande (1500+ líneas) y sigue el patrón de duplicar lógica de módulos `.mjs` (`points.mjs`, `ranks.mjs`) a mano porque no se cargan como `<script type=module>`. Esto es un footgun: cualquier cambio en la fórmula de puntos o rangos hay que hacerlo en dos lugares y no hay test que falle si se olvida uno.
- Migraciones nuevas sin aplicar/verificar en remoto: `20260826040000`, `20260826050000`, `20260826060000` — confirmar que corrieron contra el proyecto real antes de asumir que los campos existen.
- `discord-bot/` (servicio standalone) sin definir dónde se despliega ni qué env vars requiere más allá de token/guild ID.

## 6. Próximos pasos sugeridos (orden)

1. Deployear `passport-profile` y `discord-verify` pendientes, verificar búsqueda de builders en navegador logueado.
2. Agregar `player_id`/`discord_id` estable a las vistas públicas — desbloquea el resto.
3. Cargar `points.mjs`/`ranks.mjs` como módulos reales en `index.html` para eliminar la duplicación con `app.js`.
4. Definir si hay temporadas (reset de ranking) — decisión de producto, no solo técnica.
5. Notificación de subida de rango / nuevo evento vía `discord-bot/`.
