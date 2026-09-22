# Tellus Social Ops

Centro privado de descubrimiento y producción de contenido social para el equipo Tellus.

## Ruta

Aplicación estática autocontenida en `/ops/social/`. No modifica la homepage pública ni `/ops/stellar/`.

- `/ops/social/?preview=1` — vista previa con datos de ejemplo, sin autenticación.
- `/ops/social/` — Supabase Auth y datos reales. Usa las mismas cuentas y contraseñas que Stellar Ops (mismo proyecto Supabase, mismas membresías y roles).

## Preview local

```bash
npm run dev
# http://localhost:8080/ops/social/?preview=1
```

## Módulos (Fase 1)

- **Feed** — publicaciones capturadas de X / LinkedIn / Instagram, con filtros por plataforma, categoría y texto. Captura manual mientras no exista el scraper.
- **Cuentas** — cuentas observadas con categoría editorial (SaaS, memes, IA, repos, …). Semilla en la migración `20260717120000_create_social_analyzer.sql`.
- **Repos** — buscador vía la Edge Function `github-search`, con categorías curadas para repos nuevos, UX, IA, blockchain y proyectos llamativos. Cada búsqueda guarda automáticamente los repos nuevos en `repo_picks` y genera una sola vez posts para X, WhatsApp, Discord, LinkedIn e Instagram. Se conservan las fuentes, el modelo y la fecha de generación. El historial permite filtrar por fecha, abrir todos los posts, cambiar el estado y eliminar el repo junto con su contenido generado. Antes de generar, `generate-article` vuelve a verificar el repo en GitHub.
- **Artículos** — generador diario para el boletín Beehiiv: elegís plantilla (cripto/IA), cuántos (1-5) y Generar; cada borrador se puede guardar, copiar o descartar. Los posts de repos también se guardan acá con `prompt_key = 'x_post'`.

## Fases siguientes

- **Fase 2** — worker Python + Scrapling con sesión de solo lectura de una cuenta X secundaria; corre por cron e inserta en `social_posts` con `source = 'scraper'`.
- **Fase 3** — análisis con Gemini (clasificación de hook/formato/tema y scoring viral) vía Edge Function.
- **Fase 4** — banco de memes y editor.
- **Fase 5** — LinkedIn e Instagram (API oficial o proveedor externo).

## Seguridad

- Mismo modelo que Stellar Ops: RLS en todas las tablas, lectura para miembros de la organización, escritura para roles distintos de `viewer`.
- La clave publishable de `config.js` es pública a propósito; la autorización la aplica RLS.
- La API key de Gemini y las cookies de sesión de X del scraper son secretos del worker (GitHub Actions secrets o Supabase Edge Function secrets). Nunca en `config.js`, `.env.local` ni en Git.
- `GITHUB_TOKEN` (personal access token, solo permiso `public_repo` de lectura) es un secreto de Supabase Edge Function, igual que `GEMINI_API_KEY`. Se configura con `supabase secrets set GITHUB_TOKEN=ghp_...` — nunca en el frontend.

## Convención de caché

`app.js` y `styles.css` se referencian con `?v=YYYYMMDD-NN` en `index.html`. Subí AMBAS versiones en cada cambio — `tests/social-ops.test.mjs` falla si difieren.
