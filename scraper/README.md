# Social scraper worker — Fase 2

Worker Python que llena `public.social_posts` con las publicaciones recientes de
las cuentas de X activas en `social_accounts`. No corre en el navegador ni en
Vercel: es un proceso de fondo (cron de GitHub Actions o local).

## Fuentes

1. **GraphQL de X + cookies** (primaria) — `sources/x_graphql.py`. Pega a los
   mismos endpoints que usa la web de X, autenticado con las cookies de la
   cuenta secundaria de **solo lectura**. Métricas exactas. X rota los
   `queryId` en cada deploy: cuando devuelva 404, capturá los nuevos desde
   Network en el navegador logueado y pegalos en `x_endpoints.json`.
2. **Nitter** (fallback) — `sources/nitter.py`. Front-end alternativo de X, sin
   login, sin riesgo para la cuenta. Instancias públicas inestables; se prueban
   en orden.

Si no hay cookies configuradas, el worker usa solo Nitter.

## Variables de entorno

Local: se leen de `../.env.local`. En CI: de los *Actions secrets*.

| Variable | Obligatoria | Para qué |
|---|---|---|
| `SUPABASE_URL` | sí | Proyecto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | sí | Escribir saltando RLS. **Solo el worker. Nunca al frontend ni a Git.** |
| `X_SCRAPER_AUTH_TOKEN` | no | Cookie `auth_token` de la cuenta secundaria |
| `X_SCRAPER_CT0` | no | Cookie `ct0` (token CSRF) |
| `X_QID_USER` / `X_QID_TWEETS` | no | Override de los queryId de GraphQL (alternativa a `x_endpoints.json`) |
| `NITTER_INSTANCES` | no | Lista separada por comas; default `nitter.net,nitter.poast.org` |
| `SCRAPER_DELAY_MIN` / `SCRAPER_DELAY_MAX` | no | Delay aleatorio entre cuentas (default 20–55 s) |
| `SCRAPER_MAX_POSTS` | no | Máx. posts por cuenta por corrida (default 20) |

## Correr local

```bash
cd scraper
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
scrapling install   # baja curl_cffi/playwright/browserforge (deps de Scrapling 0.4.x)

python main.py            # todas las cuentas activas
python main.py midudev    # solo una cuenta
```

## Capturar cookies y queryId de X

Con la cuenta secundaria logueada en el navegador:

- **Cookies**: DevTools → Application → Cookies → `https://x.com` → copiá
  `auth_token` y `ct0`.
- **queryId**: DevTools → Network → filtrá por `UserByScreenName` y `UserTweets`
  → el id va en la URL (`/i/api/graphql/<queryId>/UserTweets`). Pegalos en
  `x_endpoints.json`.

## Seguridad y buen comportamiento

- La cuenta de X es **solo lectura**: el worker nunca da like, sigue ni publica.
- Delays aleatorios y cron espaciado (cada 6 h) para no marcar patrón.
- `x_endpoints.json` no contiene secretos (los queryId son públicos). Las
  cookies y la service-role key viven solo en secrets, jamás en el repo.

## Cron (GitHub Actions)

`.github/workflows/social-scrape.yml` corre cada 6 h y admite disparo manual
con un handle. Cargá los secrets en **Settings → Secrets and variables →
Actions** del repo antes de habilitarlo.
