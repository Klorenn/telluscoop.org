# Tierly — pendientes próxima sesión

## Sin verificar en navegador (no lo pude probar yo)
- **Profile view nuevo** (`tierly/index.html` data-view="profile", nav item "Perfil"): antes de esta sesión `#lb-auth` no existía en el markup — `renderAuth()` en `app.js` hacía `if (!el) return` silenciosamente, o sea login/passport-link nunca se pintaban. Lo moví a la nueva vista Profile. Falta: loguearse con Discord y confirmar que se ve el pill de sesión, el gate de verificación de Discord y el link de Passport.
- **Búsqueda de Passport** (`supabase/functions/passport-profile` acción `builders`): pagina `/builders` (hasta 3 páginas de 100) filtrando por `name`/`username` porque la API no tiene búsqueda de texto. Requiere sesión activa (usa el token del usuario logueado). Falta: probar con un usuario logueado buscando un builder que NO esté en el leaderboard, y confirmar que aparece en `#lb-passport-results`.
- Falta desplegar el edge function `passport-profile` actualizado a Supabase (`supabase functions deploy passport-profile`) si no hay CI/CD automático.

## Deuda técnica / riesgos
- La búsqueda de Passport pagina hasta 300 builders por búsqueda (3 requests de 100). Si la base de Passport crece mucho, esto puede no encontrar coincidencias fuera de las primeras 300 o pegar contra el rate limit (100 req/min) si varios usuarios buscan a la vez. Si Passport agrega un parámetro `q`/`search` de verdad, cambiar `supabase/functions/passport-profile/index.ts` para usarlo en vez de paginar a mano.
- Sin caché de resultados de builders — cada tecleo (con debounce de 300ms) dispara requests nuevos. Si se nota lento o cerca del rate limit, considerar cachear la lista completa de builders en memoria del edge function con TTL corto.

## Discord bot (`discord-bot/`)
- Servicio standalone nuevo, separado del edge function `discord-verify`. Falta definir dónde se despliega (¿Railway, Fly, VPS?) y documentar variables de entorno requeridas más allá de `DISCORD_BOT_TOKEN`/`DISCORD_GUILD_ID` si las hay.

## Housekeeping
- `leaderboard/` y `ops/leaderboard/` quedaron renombrados a `tierly/` y `ops/tierly/` en este commit — revisar que no queden links rotos a `/leaderboard` en otras páginas del sitio (navegación, footer, etc.) ni en Vercel rewrites (`vercel.json`, `serve.json`).
