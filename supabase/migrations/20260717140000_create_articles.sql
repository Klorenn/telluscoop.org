-- Ops/Social — generador de artículos diarios (boletín Beehiiv)
-- Plantillas de prompt editables + artículos generados. Mismo modelo RLS.

create table public.article_prompts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key text not null,
  name text not null,
  prompt_md text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, key)
);
create index article_prompts_org_idx on public.article_prompts(organization_id, key);

create table public.articles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  prompt_key text not null default 'crypto',
  title text not null,
  subtitle text,
  summary text[] not null default '{}',
  body_md text not null,
  sources jsonb not null default '[]'::jsonb,
  model text,
  status text not null default 'draft' check (status in ('draft', 'approved', 'published', 'discarded')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index articles_org_idx on public.articles(organization_id, status, created_at desc);

create trigger article_prompts_touch before update on public.article_prompts for each row execute function public.touch_updated_at();
create trigger articles_touch before update on public.articles for each row execute function public.touch_updated_at();

alter table public.article_prompts enable row level security;
alter table public.articles enable row level security;

create policy article_prompts_member_select on public.article_prompts for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = article_prompts.organization_id and m.user_id = (select auth.uid())));
create policy article_prompts_member_all on public.article_prompts for all to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = article_prompts.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'))
with check (exists (select 1 from public.organization_members m where m.organization_id = article_prompts.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'));

create policy articles_member_select on public.articles for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = articles.organization_id and m.user_id = (select auth.uid())));
create policy articles_member_all on public.articles for all to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = articles.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'))
with check (exists (select 1 from public.organization_members m where m.organization_id = articles.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'));

grant select on public.article_prompts, public.articles to authenticated;
grant insert, update, delete on public.article_prompts, public.articles to authenticated;

-- Plantilla cripto (editorial Tellus). Dollar-quoted para no escapar comillas.
with org as (select id from public.organizations where slug = 'tellus')
insert into public.article_prompts (organization_id, key, name, prompt_md)
select org.id, 'crypto', 'Cripto diario (Beehiiv)', $prompt$Escribe una nota diaria de noticias cripto en español LATAM, con el tono y criterio editorial de Tellus Cooperative.

El artículo es un resumen de lo ocurrido el día anterior, pensado para leerse en la mañana por alguien que quiere entender qué pasó sin ruido ni hype.

VOZ Y ESTILO
- Cercano, claro y humano; como a un amigo inteligente (estilo Milk Road, sin exagerar).
- Sin jerga innecesaria, sin tono trader. Crítico pero constructivo.
- Enfocado en contexto y consecuencias, no solo en precios.
- Perspectiva LATAM: por qué lo que pasó en EE.UU., Europa o África importa en nuestra región.
- Frases cortas, ritmo ágil, analogías simples.

ESTRUCTURA OBLIGATORIA
1. Título SEO-friendly, corto y hooky (máx 5-6 palabras) que mencione el tema central del día.
2. Subtítulo SEO-friendly: 1 frase que resuma los 2-3 hechos clave, natural, sin keyword stuffing.
3. Resumen para gente ocupada: 3 a 5 bullets; cada uno responde qué pasó y por qué importa.
4. Desarrollo: secciones cortas con subtítulos; primero qué pasó, luego por qué importa; sin tecnicismos innecesarios; nada de predicciones de precio.
5. En foco (opcional): un tema transversal del día (regulación, privacidad, poder de plataformas, infraestructura) que conecte dos o más noticias.
6. Cierre Tellus: reflexión breve sobre poder y control, infraestructura financiera, inclusión o descentralización. No moralizar; invitar a pensar.

SEO: usar de forma natural Bitcoin, mercado cripto, regulación, exchanges, minería, DeFi. Lenguaje humano primero.

FUENTES: incluir todas las fuentes reales usadas, con links directos, solo medios/dashboards/comunicados confiables.

EVITAR: emojis excesivos, tono trader/gambling, clickbait vacío, copiar titulares anglo, opiniones sin contexto.$prompt$
from org;

-- Plantilla IA (misma voz, tema inteligencia artificial).
with org as (select id from public.organizations where slug = 'tellus')
insert into public.article_prompts (organization_id, key, name, prompt_md)
select org.id, 'ai', 'IA diario (Beehiiv)', $prompt$Escribe una nota diaria de noticias de inteligencia artificial en español LATAM, con el tono y criterio editorial de Tellus Cooperative.

El artículo es un resumen de lo ocurrido el día anterior, pensado para leerse en la mañana por alguien que quiere entender qué pasó sin ruido ni hype.

VOZ Y ESTILO
- Cercano, claro y humano; como a un amigo inteligente (estilo Milk Road, sin exagerar).
- Sin jerga innecesaria, sin tono de fanático. Crítico pero constructivo.
- Enfocado en contexto y consecuencias, no solo en anuncios de producto.
- Perspectiva LATAM: por qué lo que pasó en EE.UU., Europa, China o África importa en nuestra región.
- Frases cortas, ritmo ágil, analogías simples.

ESTRUCTURA OBLIGATORIA
1. Título SEO-friendly, corto y hooky (máx 5-6 palabras) que mencione el tema central del día.
2. Subtítulo SEO-friendly: 1 frase que resuma los 2-3 hechos clave, natural, sin keyword stuffing.
3. Resumen para gente ocupada: 3 a 5 bullets; cada uno responde qué pasó y por qué importa.
4. Desarrollo: secciones cortas con subtítulos; primero qué pasó, luego por qué importa; sin tecnicismos innecesarios.
5. En foco (opcional): un tema transversal del día (regulación, datos, poder de plataformas, cómputo, trabajo) que conecte dos o más noticias.
6. Cierre Tellus: reflexión breve sobre poder y control, infraestructura, inclusión o soberanía tecnológica. No moralizar; invitar a pensar.

SEO: usar de forma natural inteligencia artificial, modelos de lenguaje, código abierto, regulación, cómputo, agentes. Lenguaje humano primero.

FUENTES: incluir todas las fuentes reales usadas, con links directos, solo medios/blogs oficiales/comunicados confiables.

EVITAR: emojis excesivos, hype de producto, clickbait vacío, copiar titulares anglo, opiniones sin contexto.$prompt$
from org;
