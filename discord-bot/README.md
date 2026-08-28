# Tierly bot (Discord Gateway)

Proceso Node separado de la web y de las Supabase Edge Functions. Corre 24/7 via WebSocket (Gateway) — por eso aparece **en línea** en Discord y puede reaccionar a eventos en tiempo real (alguien entra al server), algo que una Edge Function serverless no puede hacer.

## Qué hace

- Se conecta al Gateway y queda con estado **online**, con un "watching" status.
- Al arrancar, busca (o crea) un canal de texto `bienvenida-tierly` y postea un saludo.
- Cuando alguien nuevo entra al server, lo saluda en ese canal y linkea al leaderboard.
- Si hay credenciales de Supabase configuradas, sincroniza `discord_member = true` en `gaming_players` apenas la persona entra al server — no hace falta que además haga login en la web para que quede marcada.

## Variables de entorno

| Variable | Requerida | De dónde sale |
|---|---|---|
| `DISCORD_BOT_TOKEN` | sí | Discord Developer Portal → Bot → Token (la misma que ya usás en Supabase Edge Functions) |
| `DISCORD_GUILD_ID` | sí | ID del server de Tellus (clic derecho al server → Copy Server ID, con modo desarrollador activado) |
| `WELCOME_CHANNEL_ID` | no | ID de un canal existente si querés elegirlo vos. Si lo dejás vacío, Tierly crea/usa `bienvenida-tierly` |
| `ANNOUNCE_CHANNEL_ID` | no | ID de un canal para anuncios (eventos nuevos, subidas de rango). Si lo dejás vacío, Tierly crea/usa `anuncios-tierly` |
| `SUPABASE_URL` | no (recomendada) | `https://rhzanxzoqmbxptvxgnfj.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | no (recomendada) | Supabase Dashboard → Project Settings → API → `service_role` (secreto, nunca en el frontend) |

## Antes de desplegar: Developer Portal

En https://discord.com/developers/applications → tu app Tierly → **Bot**:

1. Activá **SERVER MEMBERS INTENT** (obligatorio — sin esto `guildMemberAdd` no dispara y el bot no ve quién entra).
2. Verificá que el bot ya esté agregado al server de Tellus con permisos: `View Channels`, `Send Messages`, `Manage Channels` (este último solo si querés que cree el canal solo).

## Deploy en Render

Es un bot de Gateway (WebSocket persistente, no HTTP) → el tipo de servicio correcto en Render es **Background Worker**, no Web Service (no expone puerto ni necesita healthcheck HTTP).

1. render.com → **New +** → **Background Worker**.
2. Connect a repository → seleccioná este repo (tiene que estar pusheado a GitHub primero).
3. **Root Directory** → `discord-bot`.
4. **Build Command** → `npm install`.
5. **Start Command** → `npm start`.
6. **Instance Type** → Free alcanza para empezar (ojo: el free tier de Background Worker en Render no duerme como el de Web Service, pero puede reiniciar en deploys — el bot reconecta solo al Gateway al arrancar).
7. Environment → **Add Environment Variable** → cargá las 5 de la tabla de arriba.
8. Create Background Worker. Deploy corre solo.
9. En Logs deberías ver `Tierly conectado como Tierly#XXXX` y el bot pasa a **online** en Discord.

## Local

```bash
cd discord-bot
npm install
DISCORD_BOT_TOKEN=... DISCORD_GUILD_ID=... npm start
```
