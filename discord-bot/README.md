# Tierly bot (Discord Gateway)

Proceso Node separado de la web y de las Supabase Edge Functions. Corre 24/7 via WebSocket (Gateway) — por eso aparece **en línea** en Discord y puede reaccionar a eventos en tiempo real (alguien entra al server), algo que una Edge Function serverless no puede hacer.

## Qué hace

- Se conecta al Gateway y queda con estado **online**, con un "watching" status.
- Al arrancar, busca (o crea) un canal de texto `bienvenida-tierly` y postea un saludo.
- Cuando alguien nuevo entra al server, lo saluda en ese canal y linkea al leaderboard.
- Si hay credenciales de Supabase configuradas, sincroniza `discord_member = true` en `gaming_players` apenas la persona entra al server — no hace falta que además haga login en la web para que quede marcada.
- Cualquier miembro puede escribir `!bienvenida` en el canal del bot para forzar su propio saludo + sync manual (útil para quien ya era miembro del server antes de que el bot arrancara, ya que `guildMemberAdd` no dispara retroactivamente).

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

1. Activá **SERVER MEMBERS INTENT** y **MESSAGE CONTENT INTENT** (obligatorios — sin el primero `guildMemberAdd` no dispara, sin el segundo el comando `!bienvenida` no funciona).
2. Verificá que el bot ya esté agregado al server de Tellus con permisos: `View Channels`, `Send Messages`, `Manage Channels` (este último solo si querés que cree el canal solo).

## Deploy en Google Cloud (e2-micro, free tier)

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

Cargá las 5 variables de entorno de la tabla de arriba en `discord-bot/.env` (usar `dotenv` o exportarlas en el servicio de systemd, nunca hardcodeadas en el código).

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
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now tierly-bot
sudo journalctl -u tierly-bot -f   # logs en vivo
```

Deberías ver `Tierly conectado como Tierly#XXXX` y el bot pasa a **online** en Discord.

### Actualizar el bot (nuevo deploy)

```bash
gcloud compute ssh tierly-bot --zone=us-west1-b
cd tellus && git pull && cd discord-bot && npm install
sudo systemctl restart tierly-bot
```

### Alternativa paga (más simple, sin manejar VM)

Render Background Worker, Starter ($7/mes) — deploy con git push, sin SSH ni systemd. Ver commits previos de este README si se quiere volver a esa opción.

## Local

```bash
cd discord-bot
npm install
DISCORD_BOT_TOKEN=... DISCORD_GUILD_ID=... npm start
```
