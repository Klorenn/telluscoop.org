# Tierly bot (Discord Gateway)

Proceso Node separado de la web y de las Supabase Edge Functions. Corre 24/7 via WebSocket (Gateway) — por eso aparece **en línea** en Discord y puede reaccionar a eventos en tiempo real (alguien entra al server), algo que una Edge Function serverless no puede hacer.

## Qué hace

- Se conecta al Gateway y queda con estado **online**, con un "watching" status.
- Al arrancar, busca (o crea) un canal de texto `bienvenida-tierly` y postea un saludo.
- Cuando alguien nuevo entra al server, lo saluda en ese canal y linkea al leaderboard.
- Si hay credenciales de Supabase configuradas, sincroniza `discord_member = true` en `gaming_players` apenas la persona entra al server — no hace falta que además haga login en la web para que quede marcada.
- Cualquier miembro puede escribir `!bienvenida` en el canal del bot para forzar su propio saludo + sync manual (útil para quien ya era miembro del server antes de que el bot arrancara, ya que `guildMemberAdd` no dispara retroactivamente).
- Observa `presenceUpdate` para abrir y cerrar sesiones de juegos, reconcilia la caché al arrancar y mantiene las sesiones activas con un heartbeat cada cinco minutos. La cobertura depende de la visibilidad de presence de cada usuario.

## Variables de entorno

El proceso carga `discord-bot/.env` mediante `node --env-file=.env`. Ese archivo es
local y está ignorado por Git. Nunca se deben pegar sus valores en tickets, logs,
capturas ni documentación.

| Variable | Requerida | Uso |
|---|---|---|
| `DISCORD_BOT_TOKEN` | sí* | Token del bot en Discord Developer Portal → Bot → Token |
| `DISCORD_TOKEN` | sí* | Alias legado aceptado por el proceso; preferir `DISCORD_BOT_TOKEN` |
| `DISCORD_GUILD_ID` | sí | ID del servidor de Tellus |
| `WELCOME_CHANNEL_ID` | no | Canal de bienvenida existente; si falta, usa o crea `bienvenida-tierly` |
| `ANNOUNCE_CHANNEL_ID` | no | Canal de anuncios existente; si falta, usa o crea `anuncios-tierly` |
| `SUPABASE_URL` | no** | URL de Supabase; preferirla sobre `NEXT_PUBLIC_SUPABASE_URL` |
| `NEXT_PUBLIC_SUPABASE_URL` | no** | Alias legado para la URL de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | no** | Clave `service_role`, solo en el proceso persistente y nunca en el frontend |

\* Se requiere una de `DISCORD_BOT_TOKEN` o `DISCORD_TOKEN`.

\*\* Se requieren juntas `SUPABASE_URL` (o su alias) y `SUPABASE_SERVICE_ROLE_KEY`
para sincronización, sesiones, anuncios y notificaciones. Sin ellas el bot puede
conectarse a Discord, pero esas funciones quedan desactivadas.

`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` no es utilizada por este proceso.

## Antes de desplegar: Developer Portal

En https://discord.com/developers/applications → tu app Tierly → **Bot**:

1. Activá **SERVER MEMBERS INTENT**, **MESSAGE CONTENT INTENT** y **PRESENCE INTENT** (obligatorios — sin el primero `guildMemberAdd` no dispara, sin el segundo el comando `!bienvenida` no funciona y sin el tercero no se reciben presences).
2. Verificá que el bot ya esté agregado al server de Tellus con permisos: `View Channels`, `Send Messages`, `Manage Channels` (este último solo si querés que cree el canal solo).

## Arranque persistente en Google Cloud (e2-micro, free tier)

Es un bot de Gateway (WebSocket persistente) → necesita un proceso que no se duerma. Render ya no tiene free tier para Background Worker (mínimo $7/mes). GCP ofrece una VM `e2-micro` gratis para siempre (Compute Engine Always Free), así que corremos el bot ahí con `systemd`.

### 1. Crear la VM

```bash
gcloud compute instances create tierly-bot \
  --zone=us-west1-b \
  --machine-type=e2-micro \
  --image-family=debian-12 \
  --image-project=debian-cloud \
  --boot-disk-size=30GB
```

Usar una zona dentro de las elegibles para Always Free (`us-west1`, `us-central1` o `us-east1`) para que la VM no cobre.

### 2. Conectarse e instalar Node

```bash
gcloud compute ssh tierly-bot --zone=us-west1-b
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git
```

### 3. Clonar el repo y configurar

```bash
git clone <url-del-repo> tellus
cd tellus/discord-bot
npm install
```

Crear `discord-bot/.env` con las variables necesarias de la tabla anterior. No
usar `dotenv` adicional: el script `npm start` ya emplea la capacidad nativa
`--env-file` de Node. Validar que la VM use Node 20.6 o superior.

### 4. Servicio systemd (mantiene el bot corriendo 24/7 y lo reinicia si crashea)

Crear `/etc/systemd/system/tierly-bot.service`:

```ini
[Unit]
Description=Tierly Discord bot
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/<usuario>/tellus/discord-bot
EnvironmentFile=/home/<usuario>/tellus/discord-bot/.env
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=30
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now tierly-bot
sudo journalctl -u tierly-bot -f   # logs en vivo
```

Deberías ver `Tierly conectado como Tierly#XXXX` y el bot pasa a **online** en Discord.

## Health y reinicio: checklist

No existe un endpoint HTTP de health en este bot. La verificación operativa es
el estado del servicio, el último log de conexión y el estado **online** en
Discord:

```bash
sudo systemctl is-enabled tierly-bot
sudo systemctl is-active tierly-bot
sudo systemctl status tierly-bot --no-pager
sudo journalctl -u tierly-bot -n 100 --no-pager
```

Después de reiniciar, confirmar:

- aparece `Tierly conectado como ...` en los logs;
- el bot aparece **online** en Discord;
- se puede ejecutar `!bienvenida` en el servidor configurado;
- si Supabase está habilitado, no aparecen errores de bootstrap, heartbeat o poll;
- `GuildMembers`, `Message Content` y `Presence Intent` siguen habilitados en Discord.

Si el proceso está activo pero no aparece online, revisar primero token, red,
intents privilegiados y permisos del bot antes de cambiar código.

## Verificación de cron y rollback

Los tres jobs de Tierly se crean en la migración
`20260929092000_tierly_v0_jobs.sql` con estos nombres y horarios UTC:

| Job | Horario | Función |
|---|---:|---|
| `tierly-rollup-diario` | `15 4 * * *` | `tierly_rollup_day()` |
| `tierly-cerrar-sesiones-viejas` | `5 * * * *` | `tierly_close_stale_sessions()` |
| `tierly-sugerencias` | `30 4 * * *` | `tierly_generate_suggestions()` |

Verificar desde el SQL Editor con una sesión administrativa:

```sql
select jobid, jobname, schedule, active, command
from cron.job
where jobname in (
  'tierly-rollup-diario',
  'tierly-cerrar-sesiones-viejas',
  'tierly-sugerencias'
)
order by jobname;

select jobid, runid, status, return_message, start_time, end_time
from cron.job_run_details
where jobid in (
  select jobid from cron.job
  where jobname like 'tierly-%'
)
order by start_time desc
limit 20;
```

No se debe editar `cron.job` manualmente como sustituto de una migración.
Para rollback de la migración, primero detener cambios de código que dependan
de sus funciones, guardar la salida de las consultas anteriores y aplicar una
migración de reversión revisada que elimine únicamente esos tres jobs y sus
funciones. No se debe ejecutar `drop extension pg_cron`, porque otros módulos
del proyecto también pueden usarla. Si el problema es solo el bot, detenerlo
con `sudo systemctl stop tierly-bot` sin tocar los jobs de base de datos.

### Actualizar el bot (nuevo despliegue)

```bash
gcloud compute ssh tierly-bot --zone=us-west1-b
cd tellus && git pull && cd discord-bot && npm install
sudo systemctl restart tierly-bot
```

Verificar el checklist anterior antes y después del reinicio. Si falla, volver
al commit previamente validado, ejecutar `npm install` y reiniciar el servicio;
no sobrescribir `.env` durante el rollback.

### Alternativa paga (más simple, sin manejar VM)

Render Background Worker, Starter ($7/mes) — deploy con git push, sin SSH ni systemd. Ver commits previos de este README si se quiere volver a esa opción.

## Local

```bash
cd discord-bot
npm install
DISCORD_BOT_TOKEN=... DISCORD_GUILD_ID=... npm start
```
