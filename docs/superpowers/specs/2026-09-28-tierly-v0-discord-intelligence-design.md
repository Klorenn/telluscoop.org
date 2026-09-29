# Tierly V0 — Discord Intelligence

Fecha: 2026-09-28
Estado: diseño aprobado, pendiente de plan de implementación

## Qué es V0

El bot de Tierly observa la actividad de juego que los miembros exponen vía
Discord presence y la convierte en inteligencia agregada para el dueño del
servidor: qué se juega, cuánta gente distinta aparece, qué sube y qué baja, y
qué eventos valdría la pena lanzar.

V0 termina donde empieza la decisión humana. Tierly sugiere; el dueño del
servidor decide. No hay creación de eventos, no hay identidad Tierly, no hay
XP, no hay perfiles públicos y no hay blockchain — eso es V1 y V2.

## Qué no es

- No es verificación de logros. El presence de Discord es prueba de
  participación, no prueba anti-cheat de que alguien haya hecho algo dentro de
  un juego.
- No es un censo. Cada persona puede ocultar su presence, así que la cobertura
  nunca es total. Toda métrica que se muestre al admin lo declara.
- No es un rastreador de miembros. El dashboard nunca muestra quién jugó a qué.

## Contexto: evolución, no producto nuevo

V0 es la evolución del Tierly que ya vive en este repo, no un producto
paralelo. Se retira lo que el roadmap deja obsoleto y se reconstruye sobre un
modelo nuevo.

**Se elimina** (schema y código, sin flags muertos ni tablas archivadas):

- Brackets y torneos.
- Leaderboard público (top 50 + búsqueda): es ranking global sin noción de
  guild, incompatible con multi-tenancy.
- Perfil público del jugador (ranking + tiers en `/tierly`): vuelve en V2 como
  pasaporte con el modelo nuevo. No existe hoy ninguna ruta
  `/tierly/u/:username`; lo público es `/tierly` vía rewrite en `vercel.json`.
- Tiers y divisiones (Bronce→Diamante): V2 trae XP, niveles y stamps; sostener
  dos sistemas de progresión en paralelo es deuda pura.

**Se conserva**: Racer y Chess, que son juegos propios y no dependen del modelo
de presence. Ambos comparten `gaming_players` y `gaming_match_participants`, así
que esas dos tablas sobreviven; lo que se elimina es la capa de bracket montada
encima.

**Datos existentes**: descartables. El modelo nuevo arranca limpio; no se
migran puntos, tiers ni historial de partidas.

**`ops/tierly/` se transforma**: sale la gestión de brackets, entra el panel de
inteligencia. Mismo shell, misma auth, mismo stack sin bundler.

## Decisiones de arquitectura

| Decisión | Elegido | Por qué |
|---|---|---|
| Alcance | Multi-tenant desde el día uno | V3 es descubrimiento cross-server; retrofitear `guild_id` después es caro. En la práctica arranca con un guild instalado y sin flujo público de instalación. |
| Granularidad de presence | Sesiones per-usuario con retención corta + rollups permanentes | La sesión es el único hecho crudo del que después se derivan agregados, XP, rachas e historial. Reconstruirla desde agregados es imposible. La retención acotada limita la exposición. |
| Superficie admin | Transformar `ops/tierly/` | Un solo admin que muta, en vez de dos conviviendo. |
| Ingesta | El bot escribe directo a Postgres con service-role | Menos piezas, cero latencia extra, mismo patrón que el bot ya usa. Requiere las mitigaciones de durabilidad descritas abajo. |

## Modelo de datos

Todo scopeado por `guild_id`. Schema nuevo.

### Tenencia

- **`communities`** — `guild_id` (snowflake, PK), `name`, `icon_url`,
  `installed_at`, `locale`, `timezone`, `retention_days` (default 30),
  `presence_enabled`, `session_cap_minutes` (default 480),
  `stale_session_hours` (default 12), `suggestion_threshold` (default 5).
- **`community_admins`** — `guild_id`, `user_id` (→ `auth.users`),
  `discord_user_id`, `role`. Es la tabla contra la que resuelve toda la RLS.

Los umbrales viven como configuración por comunidad, no como constantes en
código, para poder ajustarlos con datos reales sin desplegar.

### Identidad observada

- **`observed_members`** — `guild_id`, `discord_user_id`, `first_seen_at`,
  `last_seen_at`, `opted_in` (false por defecto).

Existe porque la segmentación futura ("¿a quiénes invito?") necesita saber a
quién. Es el registro de gente que todavía no es usuaria de Tierly, así que se
trata como dato sensible: nunca se expone nominalmente al dashboard en V0, solo
como conteo, y se purga junto con las sesiones cuando el miembro deja el guild.

### Catálogo de juegos

- **`games`** — `id`, `canonical_name`, `display_name`.
- **`game_aliases`** — `raw_activity_name` → `game_id`.

Los nombres de actividad de Discord llegan sucios y variables ("Fortnite",
"Fortnite ", "Fortnite Battle Royale"). Sin normalización las tendencias son
basura: un mismo juego aparece como cinco.

### Hechos

- **`play_sessions`** — `guild_id`, `discord_user_id`, `game_id`, `started_at`,
  `ended_at` (nulo = abierta), `last_heartbeat_at`, `minutes` (generada),
  `closed_reason` (`normal | heartbeat | crash | timeout`). Retención
  `retention_days`, purga diaria.
  Índice único parcial sobre `(guild_id, discord_user_id, game_id)
  WHERE ended_at IS NULL`: no pueden existir dos sesiones abiertas del mismo
  trío, lo que hace idempotente la apertura frente a eventos duplicados de
  Discord.
- **`daily_game_rollups`** — `guild_id`, `game_id`, `day`, `unique_players`,
  `total_minutes`, `session_count`. **Permanente**: es la memoria larga de la
  comunidad y lo único que sobrevive a la purga.
- **`suggested_events`** — `guild_id`, `game_id`, `generated_at`,
  `window_days`, `player_count`, `status` (`pending | accepted | dismissed`).

### RLS

Lectura solo para admins del guild, resuelta vía `community_admins`. Toda
escritura es service-role desde el bot. Ninguna tabla de este set es legible
por `anon`: V0 no tiene superficie pública.

## Ingesta y ciclo de vida de sesión

### Intents

Hay que habilitar `GUILD_PRESENCES` en el portal de Discord; hoy el bot corre
sin él. Es un intent privilegiado: por debajo de 100 servidores se activa sin
revisión. Cada usuario puede además ocultar su presence del lado del cliente,
de modo que la cobertura nunca es del 100%.

### Apertura de sesión

`presenceUpdate(oldPresence, newPresence)` trae el array `activities`. Solo se
consideran las de `type: Playing`; se ignoran Streaming, Listening, Custom
Status y Competing. Comparando el set viejo contra el nuevo salen dos deltas:
juegos que aparecieron (abrir) y que desaparecieron (cerrar).

Al abrir: se resuelve `raw_activity_name` → `game_id` vía `game_aliases`, y si
no existe se crea `games` + alias con el nombre crudo. Se inserta
`play_sessions` con `ended_at` nulo y se hace upsert de `observed_members`. La
escritura es inmediata, no diferida: es lo que hace durable la ingesta directa.

### Heartbeat — mecanismo principal de cierre

Cada 5 minutos el bot recorre su caché de presencias y la compara contra las
sesiones abiertas en la base:

- Sesión abierta y el juego sigue presente → actualiza `last_heartbeat_at`.
- Sesión abierta y el juego ya no aparece → cierra con `ended_at =
  last_heartbeat_at` y `closed_reason='heartbeat'`.

El heartbeat es local: lee la caché del cliente, sin llamadas a la API de
Discord. Elimina las sesiones fantasma de raíz, sobrevive a los eventos de
cierre que Discord pierde, y da precisión de ±5 minutos en los minutos
jugados.

El evento `presenceUpdate` de cierre sigue atendiéndose (`closed_reason=
'normal'`) porque es más preciso cuando llega; el heartbeat es la garantía de
que el cierre ocurre incluso cuando no llega.

### Modos de falla y defensas

| Falla | Defensa |
|---|---|
| El bot muere con sesiones abiertas | Al arrancar cierra todas las sesiones abiertas del guild con `closed_reason='crash'`, usando `last_heartbeat_at` como `ended_at`. |
| El usuario deja el juego con el bot caído | Job diario que cierra toda sesión con `last_heartbeat_at` más viejo que `stale_session_hours` (12h), con `closed_reason='timeout'`. Con el heartbeat activo casi nunca se dispara: es red de seguridad. |
| Sesión fantasma (juego abierto toda la noche) | `minutes` se capea a `session_cap_minutes` (8h) al agregar a los rollups. Sin el cap, una sola persona dormida distorsiona la tendencia del juego. |

### Reconciliación al arrancar

Al conectarse, el bot lee el presence actual de los miembros en caché y abre
sesiones para quien ya esté jugando. Sin esto, cada despliegue pierde todo lo
que estaba en curso.

### Rollups y purga

`pg_cron` diario, en una transacción y en este orden:

1. Agregar las sesiones cerradas del día anterior a `daily_game_rollups`,
   aplicando el cap de minutos.
2. Purgar `play_sessions` más viejas que `retention_days`.

El orden importa: agregar primero, purgar después.

### Generación de sugerencias

Job diario, sobre rollups, no sobre sesiones: por guild y juego cuenta
jugadores únicos en una ventana de 7 días; si supera `suggestion_threshold` y
no existe ya una sugerencia `pending` para ese juego, inserta en
`suggested_events`. Es una consulta agregada, no un modelo. V0 no necesita más.

## Dashboard admin

### Acceso

Login por Supabase Auth; la sesión resuelve contra `community_admins` y el
admin ve solo los guilds donde lo es. Con más de un guild aparece un selector;
con uno solo entra directo. El filtrado real lo hace la RLS — el front no
filtra por su cuenta.

### Vistas

1. **Juegos activos** — qué se jugó en los últimos 7 y 30 días, ordenado por
   jugadores únicos, con minutos totales al lado.
2. **Jugadores únicos** — cuánta gente distinta apareció por semana y qué
   porción del servidor representa. Incluye la declaración de cobertura ("N
   miembros tienen presence visible"); el dato nunca se presenta como si fuera
   el servidor entero.
3. **Tendencias** — juegos subiendo o bajando contra la semana previa.
4. **Eventos sugeridos** — tarjetas del tipo "34 miembros jugaron Fortnite esta
   semana", con tres acciones: aceptar, descartar, posponer. En V0 aceptar
   marca el estado y entrega el texto listo para copiar al canal; la creación
   real del evento llega en V1.

### Límites deliberados

El dashboard nunca muestra quién jugó a qué: todo es conteo agregado. La lista
nominal de a quién invitar llega en V1, junto con un flujo de consentimiento.
Exponerla en V0 convertiría el panel en un rastreador de miembros.

### Estados vacíos

Los primeros días no hay datos. Cada vista arranca explicando qué va a aparecer
y cuándo, en lugar de mostrar cero como si fuera un error.

## Privacidad

- Analítica de comunidad = agregada. Progresión personal = opt-in (V2).
- Las sesiones per-usuario son efímeras (`retention_days`); los rollups
  agregados son permanentes.
- `observed_members` nunca se expone nominalmente en V0.
- Si un miembro deja el guild, sus sesiones y su fila de `observed_members` se
  purgan.
- El presence es dato privilegiado y controlable por cada usuario: el producto
  asume cobertura parcial y lo comunica.

## Testing

Tests en `node --test tests/*.test.mjs`, siguiendo el patrón del repo: lógica
pura extraída a módulos importables, sin necesidad de Discord ni Supabase en
vivo.

- **Normalización de juegos**: nombres crudos variables → mismo `game_id`.
- **Deltas de presence**: viejo vs. nuevo set de actividades → aperturas y
  cierres correctos; actividades no-`Playing` ignoradas.
- **Heartbeat**: sesión viva se mantiene; sesión cuyo juego desapareció se
  cierra con `ended_at = last_heartbeat_at`.
- **Cap de minutos**: sesión de 14h aporta 8h al rollup.
- **Cierre por crash y por timeout**: `closed_reason` correcto en cada caso.
- **Rollups**: conjunto de sesiones conocido → `unique_players`,
  `total_minutes` y `session_count` esperados.
- **Umbral de sugerencias**: por debajo no genera; por encima genera una sola
  mientras haya una `pending`.
- **RLS**: un admin de un guild no lee filas de otro.

## Despliegue

El bot pasa a requerir `GUILD_PRESENCES`, lo que aumenta el volumen de eventos
del Gateway y el tamaño de la caché en memoria. Sigue en la VM `e2-micro` de
GCP con systemd y `Restart=always`; hay que vigilar memoria, ya que la caché de
presencias crece con el tamaño del guild. El heartbeat cada 5 minutos es
trabajo local y no agrega llamadas a la API.

Ninguna credencial nueva entra al frontend. El service-role sigue siendo
exclusivo del proceso del bot vía `discord-bot/.env`.

## Fuera de alcance (posterior)

- **V1**: crear eventos reales desde las sugerencias, recordatorios,
  inscripciones, resultados.
- **V2**: identidad Tierly, smart accounts, XP, niveles, stamps, rachas,
  historial de juego, perfiles públicos.
- **V3**: tierly.com como capa de descubrimiento cross-server.
- **V4**: integraciones con cuentas de juego y publishers, API para
  desarrolladores, credenciales portables.
