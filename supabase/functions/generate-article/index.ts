import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Wide-open CORS is safe here: authorization is enforced by the user JWT +
// membership check, not by origin. Locking origin broke www.* visitors.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json" },
});

// Ordered fallback: 3.5-flash rejects with "high demand" often; 3-flash-preview picks up.
const MODELS = ["gemini-3.5-flash", "gemini-3-flash-preview", "gemini-2.5-flash"];
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";

async function callGemini(apiKey: string, input: string, useTools = true): Promise<{ data: Record<string, unknown>; model: string }> {
  const errors: string[] = [];
  for (const model of MODELS) {
    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        input,
        ...(useTools ? { tools: [{ type: "google_search" }, { type: "url_context" }] } : {}),
      }),
    });

    const text = await response.text();
    if (response.ok) {
      const data = JSON.parse(text) as Record<string, unknown>;
      // The interactions API can 200 with an error payload (e.g. model overloaded).
      if (!data.error) return { data, model };
      errors.push(`${model}: ${JSON.stringify(data.error).slice(0, 200)}`);
      continue;
    }
    errors.push(`${model} ${response.status}: ${text.slice(0, 200)}`);
  }
  throw new Error(`Gemini falló con todos los modelos → ${errors.join(" | ")}`);
}

// With tools active, output_text is often absent: the answer lives in the last
// text block of the steps array.
function extractText(data: Record<string, unknown>): string {
  if (typeof data.output_text === "string" && data.output_text) return data.output_text;
  let last = "";
  for (const step of (data.steps as Record<string, unknown>[]) ?? []) {
    for (const content of (step.content as Record<string, unknown>[]) ?? []) {
      if (content.type === "text" && typeof content.text === "string" && content.text.trim()) last = content.text;
    }
  }
  return last;
}

function parseJsonLoose(text: string): Record<string, unknown> {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return {};
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

type Lang = "es" | "en";

function readLang(value: unknown): Lang {
  return value === "en" ? "en" : "es";
}

// Shared across every generation call: language, the "Stellar" spelling gotcha
// (Spanish autocorrect/models love to write "estelar"), and a house rule
// against dash-heavy AI-sounding punctuation.
function styleRules(lang: Lang): string {
  const noDashes = 'No uses guiones ("-") ni rayas ("—") como puntuación para separar ideas o hacer pausas dramáticas; usa comas, puntos o dos puntos en su lugar. Sí puedes usar "-" dentro de un handle o URL si corresponde.';
  const stellar = 'Cuando te refieras a la red/proyecto "Stellar", escribe siempre "Stellar" tal cual, en inglés — NUNCA lo traduzcas ni escribas "estelar" o "Estelar".';
  if (lang === "en") {
    return `Write in natural, warm English (Tellus Cooperative editorial voice). ${stellar} ${noDashes.replace("guiones", "hyphens").replace("rayas", "em dashes").replace("Sí puedes usar", "You may still use a hyphen inside a handle or URL if it belongs there").replace(/["“”]/g, '"')}`;
  }
  return `Escribe en español chileno neutro (tuteo, natural, sin voseo argentino ni españolismos). ${stellar} ${noDashes}`;
}

// Every named entity in an article links to its official site on first
// mention, and factual claims link their source inline — not just in the
// sources block at the end.
function inlineLinkRules(lang: Lang): string {
  if (lang === "en") {
    return `Inline links (mandatory): the FIRST time you mention any project, company, protocol, token, product or tool (e.g. Stellar, Circle, USDC, Ethereum, Bitcoin, OpenAI, an exchange, a wallet), turn that mention into a real Markdown hyperlink to its OFFICIAL site — e.g. [Stellar](https://stellar.org), [Circle](https://www.circle.com). Verify the URL with Google Search; never invent domains. For news claims (a launch, a license, a hack, a price move), link the claim to its real source article inline. Link each entity only on its first mention; later mentions stay plain text.`;
  }
  return `Hipervínculos en el texto (obligatorio): la PRIMERA vez que menciones cualquier proyecto, empresa, protocolo, token, producto o herramienta (ej: Stellar, Circle, USDC, Ethereum, Bitcoin, OpenAI, un exchange, una wallet), convierte esa mención en un hipervínculo Markdown real a su sitio OFICIAL — ej: [Stellar](https://stellar.org), [Circle](https://www.circle.com). Verifica la URL con Google Search; nunca inventes dominios. Para afirmaciones noticiosas (un lanzamiento, una licencia, un hackeo, un movimiento de precio), enlaza la afirmación a su fuente real en el mismo párrafo. Cada entidad se enlaza solo en su primera mención; las siguientes van en texto plano.`;
}

// Language-agnostic house rules for features that reply to someone ELSE's
// post: the reply must match THAT post's language, not the app's toggle.
function houseRules(): string {
  return 'Cuando menciones "Stellar" (la red/proyecto), escríbelo siempre "Stellar" en inglés, nunca "estelar" ni "Estelar". No uses guiones ("-") ni rayas ("—") como puntuación para separar ideas; usa comas, puntos o dos puntos.';
}

// Viral X format the team likes (big AI accounts style). Facts only, no
// invented numbers.
function viralStyle(lang: Lang): string {
  if (lang === "en") {
    return `Viral X format (big AI accounts style):
- First line: hook in ALL CAPS with the strongest concrete fact.
- Second line: 1 short line of context, lowercase.
- Then 3-4 bullets starting with "→ " (results, numbers, concrete features).
- Close with 1 short punchy line.
- Only real facts from the given context, NOTHING invented. Short sentences. At most 1 emoji or none. At most 1 hashtag.`;
  }
  return `Formato viral para X (estilo cuentas grandes de IA):
- Primera línea: gancho en MAYÚSCULAS con el dato más fuerte y concreto.
- Segunda línea: contexto en 1 frase corta en minúsculas.
- Luego 3-4 bullets que empiecen con "→ " (resultados, números, features concretas).
- Cierre de 1 línea corta con impacto o invitación.
- Solo datos reales del contexto dado, NADA inventado. Frases cortas. Máximo 1 emoji o ninguno. Máximo 1 hashtag.`;
}

function postJsonContract(lang: Lang): string {
  return `Responde ÚNICAMENTE con un objeto JSON válido, sin bloques de código ni texto extra:
{"post": "${lang === "en" ? "Main X post, <=280 chars, hook + repo link" : "Post principal para X, <=280 caracteres, con gancho y el enlace del repo"}", "thread": ["0-3 tweets extra de hilo, opcionales"], "hashtags": ["2-4 hashtags relevantes sin espacios"]}`;
}

interface Draft {
  title: string;
  subtitle: string;
  summary: string[];
  body_md: string;
  sources: { url: string; title: string }[];
  model: string;
}

interface RepoContext {
  full_name?: string;
  description?: string;
  url?: string;
  language?: string;
  stars?: number;
}

function collectSources(data: Record<string, unknown>): { url: string; title: string }[] {
  const sources = new Map<string, string>();
  for (const step of (data.steps as Record<string, unknown>[]) ?? []) {
    for (const content of (step.content as Record<string, unknown>[]) ?? []) {
      for (const ann of (content.annotations as Record<string, unknown>[]) ?? []) {
        if (ann.type === "url_citation" && ann.url) sources.set(String(ann.url), String(ann.title ?? ann.url));
      }
    }
  }
  return [...sources].map(([url, title]) => ({ url, title }));
}

function yesterdayISO(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// Shared post-processing: reads title/subtitle out of the model's own
// Markdown and guarantees sources are never empty (grounding annotations
// first, then any markdown links the article itself cites).
function finalizeArticle(data: Record<string, unknown>, model: string, rawText: string, fallbackTitle: string): Draft {
  const text = rawText.replace(/^```(markdown|md)?\n?/, "").replace(/\n?```\s*$/, "").trim();
  if (!text) throw new Error(`El modelo ${model} devolvió una respuesta vacía`);

  const lines = text.split("\n");
  const title = (lines.find((l) => l.startsWith("# ")) ?? "").replace(/^# +/, "").trim();
  const subtitle = (lines.find((l) => l.startsWith("### ")) ?? "").replace(/^#+ +/, "").trim();

  let sources = collectSources(data);
  if (!sources.length) {
    const seen = new Map<string, string>();
    for (const match of text.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g)) seen.set(match[2], match[1]);
    sources = [...seen].map(([url, sourceTitle]) => ({ url, title: sourceTitle }));
  }

  return { title: title || fallbackTitle, subtitle, summary: [], body_md: text, sources, model };
}

async function generateOne(apiKey: string, promptMd: string, date: string, lang: Lang): Promise<Draft> {
  // The user's prompt template defines the full article format — the model
  // returns the complete Markdown untouched; title/subtitle are read from it.
  const input = `${promptMd}\n\nResume lo ocurrido el día anterior: ${date}. Usa Google Search para verificar cada hecho y cita fuentes reales y recientes. Fecha de publicación: hoy.

${styleRules(lang)}

${inlineLinkRules(lang)}

Responde ÚNICAMENTE con el artículo completo en Markdown, siguiendo exactamente el formato del prompt, sin comentarios extra antes ni después.`;

  const { data, model } = await callGemini(apiKey, input);
  return finalizeArticle(data, model, extractText(data), "Artículo del día");
}

async function rewriteArticle(apiKey: string, promptMd: string, sourceText: string, lang: Lang): Promise<Draft> {
  // No fresh search: the source material (any language) already has the facts.
  // The model translates/rewrites into Tellus's voice and the user's template.
  const input = `${promptMd}

No hagas una búsqueda nueva de noticias. Reescribe el siguiente material fuente con la voz y el formato de arriba, usando SOLO los hechos que contiene (puede venir en cualquier idioma; tradúcelo si hace falta):

"""
${sourceText.slice(0, 12000)}
"""

${styleRules(lang)}

${inlineLinkRules(lang)}

Responde ÚNICAMENTE con el artículo completo en Markdown, siguiendo exactamente el formato del prompt, sin comentarios extra antes ni después.`;

  const { data, model } = await callGemini(apiKey, input, false);
  return finalizeArticle(data, model, extractText(data), "Artículo reescrito");
}

async function generatePost(apiKey: string, repo: RepoContext, lang: Lang): Promise<Draft> {
  const input = `Escribe un post para X (Twitter) con la voz editorial de Tellus Cooperative sobre este repositorio de GitHub.

Repositorio: ${repo.full_name ?? ""}
Descripción: ${repo.description ?? ""}
Lenguaje: ${repo.language ?? ""}
Estrellas: ${repo.stars ?? ""}
Enlace: ${repo.url ?? ""}

Usa Google Search para entender qué hace el proyecto y por qué es interesante.

${viralStyle(lang)}

${styleRules(lang)}

El post principal usa ese formato viral e incluye el enlace del repo al final. Opcionalmente agrega 1-3 tweets de hilo con más detalle en tono normal.

${postJsonContract(lang)}`;

  const { data, model } = await callGemini(apiKey, input);
  const text = extractText(data);
  const parsed = parseJsonLoose(text);
  const thread = Array.isArray(parsed.thread) ? parsed.thread.map((t: unknown) => String(t)) : [];
  const hashtags = Array.isArray(parsed.hashtags) ? parsed.hashtags.map((h: unknown) => String(h)) : [];
  const body = [String(parsed.post ?? "").trim(), ...thread].filter(Boolean).join("\n\n") || text.trim();
  if (!body) throw new Error(`El modelo ${model} devolvió una respuesta vacía`);

  return {
    title: repo.full_name ?? "Post para X",
    subtitle: repo.description ?? "",
    summary: hashtags,
    body_md: body,
    sources: collectSources(data),
    model,
  };
}

async function generateRepoSocialPosts(apiKey: string, repo: RepoContext, lang: Lang): Promise<{ posts: Record<string, string>; sources: { url: string; title: string }[]; model: string }> {
  const input = `Eres el equipo editorial de Tellus Cooperative. Escribe un post para cada canal sobre este repositorio de GitHub.

Repositorio: ${repo.full_name ?? ""}
Descripción: ${repo.description ?? ""}
Lenguaje: ${repo.language ?? ""}
Estrellas: ${repo.stars ?? ""}
Enlace: ${repo.url ?? ""}

Usa Google Search para entender qué hace el proyecto y por qué es interesante antes de escribir.

${styleRules(lang)}

Canales:
- x: post principal SIN el link del repo (el link va en el segundo tweet). Formato obligatorio, igual a este ejemplo:
"¡ENVÍO DE AYUDA HUMANITARIA DIRECTA CON BLOCKCHAIN!
Soter (27 estrellas) usa @StellarOrg y AI para enviar ayuda directo.
→ Donantes y ONGs crean links de cobro fáciles.
→ La IA verifica necesidades en privado.
→ Impacto on-chain, privacidad total.
Súmate a construir el futuro

¿Cómo lo logra? Soter usa Smart Contracts de Soroban para crear \\"claim links\\" simples. Las ONGs y donantes generan estos enlaces, y una IA verifica de forma privada las necesidades, asegurando una distribución justa y eficiente."
OJO: ese ejemplo es de un repo blockchain, pero es SOLO un ejemplo de FORMATO — el formato aplica a CUALQUIER repo (IA, dev tools, UI, scraping, lo que sea) adaptando el contenido al dominio real del repo. Estructura: 1) gancho en MAYÚSCULAS con ¡...! sobre lo que hace el repo, 2) línea "Nombre (N estrellas) usa/hace X para Y" — menciona la @cuenta de X del proyecto o ecosistema SOLO si existe y la conoces con certeza (ej: @StellarOrg, @OpenAI); si no, omite la mención, 3) 3 bullets "→ " con lo concreto, 4) cierre corto invitando a la acción, 5) párrafo final "¿Cómo lo logra? ..." explicando la técnica en 2-3 frases. Solo datos reales del repo.
- x_reply: el segundo tweet del hilo: SOLO el enlace del repo con 1 línea corta invitando a verlo (ej: "El repo, open source: <enlace>").
- whatsapp: 2-4 líneas sobrias para compartir en grupos técnicos, sin emojis, termina con el enlace.
- discord: 2-4 líneas para un canal de comunidad/dev, tono cercano pero sin hype vacío, termina con el enlace.
- linkedin: 3-5 párrafos cortos, tono profesional, explica el valor o caso de uso, cierre con el enlace.
- instagram: caption de 2-3 líneas + 3-5 hashtags al final (sin link clickeable — invita a buscarlo o "link en bio").

Responde ÚNICAMENTE con un objeto JSON válido, sin bloques de código ni texto extra:
{"x": "post principal para X (sin link)", "x_reply": "segundo tweet con el enlace del repo", "whatsapp": "mensaje para WhatsApp", "discord": "mensaje para Discord", "linkedin": "post para LinkedIn", "instagram": "caption para Instagram"}`;

  const { data, model } = await callGemini(apiKey, input);
  const parsed = parseJsonLoose(extractText(data));
  const posts = {
    x: String(parsed.x ?? "").trim(),
    x_reply: String(parsed.x_reply ?? "").trim() || (repo.url ? `El repo, open source: ${repo.url}` : ""),
    whatsapp: String(parsed.whatsapp ?? "").trim(),
    discord: String(parsed.discord ?? "").trim(),
    linkedin: String(parsed.linkedin ?? "").trim(),
    instagram: String(parsed.instagram ?? "").trim(),
  };
  // x_reply has a local fallback, so it can't vouch for the generation.
  if (![posts.x, posts.whatsapp, posts.discord, posts.linkedin, posts.instagram].some(Boolean)) throw new Error(`El modelo ${model} devolvió una respuesta vacía`);
  return { posts, sources: collectSources(data), model };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "Método no permitido" }, 405);

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) return json({ error: "Sesión requerida" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authorization } } },
    );
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return json({ error: "Sesión inválida" }, 401);

    const { data: membership } = await supabase
      .from("organization_members")
      .select("role")
      .eq("user_id", user.id)
      .neq("role", "viewer")
      .maybeSingle();
    if (!membership) return json({ error: "Solo el equipo puede generar artículos" }, 403);

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    console.log("→ GEMINI_API_KEY present:", !!apiKey, "length:", apiKey?.length ?? 0);
    if (!apiKey) return json({ error: "Gemini todavía no está configurado" }, 503);

    const body = await request.json();
    const lang = readLang(body.lang);

    // Mode: a quick reply/comment or quote-tweet for a pasted X post.
    if (body.format === "tweet_reply") {
      const handle = String(body.handle ?? "").trim().replace(/^@/, "");
      const content = String(body.content ?? "").trim();
      const links = Array.isArray(body.links) ? body.links.map((l: unknown) => String(l)).filter(Boolean) : [];
      if (!content) return json({ error: "Falta el texto del tweet" }, 400);

      const input = `Eres el equipo de Tellus Cooperative comentando en X. Este es el post original${handle ? ` de @${handle}` : ""}:

"${content}"
${links.length ? `\nLinks que menciona: ${links.join(", ")}` : ""}

Primero, identifica en qué idioma está escrito el post original y responde en ESE MISMO idioma (inglés si el post es en inglés, español si es en español), sin importar ningún otro idioma configurado.

Adapta el tono a lo que dice el post:
- Si es un lanzamiento de repo/proyecto o un anuncio técnico: sé genuinamente entusiasta y técnico, como un par que reconoce buen trabajo. Podés destacar un detalle concreto o hacer una pregunta técnica puntual. NUNCA negativo, sarcástico ni pesado.
- Si es una opinión, debate o hot take: podés aportar un matiz, un dato o un contrapunto respetuoso — nunca genérico ni adulón ("gran post!").

Escribe:
1. Un comentario/respuesta directa al post (<=270 caracteres).
2. Un texto para citar el post (quote tweet, <=250 caracteres) agregando nuestra perspectiva.

${houseRules()}

Responde ÚNICAMENTE con un objeto JSON válido, sin bloques de código ni texto extra:
{"comment": "comentario para responder", "quote": "texto para citar el post"}`;
      try {
        const { data, model } = await callGemini(apiKey, input, false);
        const parsed = parseJsonLoose(extractText(data));
        const reply = { comment: String(parsed.comment ?? "").trim(), quote: String(parsed.quote ?? "").trim() };
        if (!reply.comment && !reply.quote) return json({ error: "El modelo devolvió una respuesta vacía" }, 502);
        return json({ reply, model });
      } catch (error) {
        return json({ error: "No se pudo generar el comentario", detail: [String(error)] }, 502);
      }
    }

    // Mode: reply + quote for several scraped tweets at once (the daily
    // engagement batch). One Gemini call for the whole batch, quota-friendly.
    if (body.format === "tweet_reply_batch") {
      const tweets = Array.isArray(body.tweets) ? body.tweets.slice(0, 8) : [];
      if (!tweets.length) return json({ error: "Falta la lista de posts" }, 400);
      const list = tweets.map((t: Record<string, unknown>, i: number) => `${i + 1}. @${String(t.handle ?? "")}: "${String(t.content ?? "").slice(0, 280)}"`).join("\n");
      const input = `Eres el equipo de Tellus Cooperative comentando en X. Estos son posts recientes de cuentas del nicho (IA, cripto, tech):

${list}

Para CADA uno, en el mismo orden:
- Identifica en qué idioma está escrito ESE post puntual y responde en ese mismo idioma (inglés si el post es en inglés, español si es en español) — cada post de la lista puede estar en un idioma distinto, tratalos de forma independiente.
- Si el post es un lanzamiento de repo/proyecto o un anuncio técnico: sé entusiasta y técnico, destacá algo concreto o hacé una pregunta técnica puntual. NUNCA negativo, sarcástico ni pesado.
- Si el post es una opinión, debate o hot take: podés aportar un matiz, un dato o un contrapunto respetuoso — nunca genérico ni adulón ("gran post!", "totalmente de acuerdo!").
- comment: comentario/respuesta directa (<=270 caracteres).
- quote: texto para citar el post (<=250 caracteres) agregando nuestra perspectiva.

${houseRules()}

Responde ÚNICAMENTE con un objeto JSON válido, sin bloques de código ni texto extra, mismo orden y misma cantidad que la lista:
{"replies": [{"comment": "...", "quote": "..."}]}`;
      try {
        const { data, model } = await callGemini(apiKey, input, false);
        const parsed = parseJsonLoose(extractText(data));
        const replies = Array.isArray(parsed.replies) ? parsed.replies as Record<string, unknown>[] : [];
        const results = tweets
          .map((t: Record<string, unknown>, i: number) => ({
            handle: String(t.handle ?? ""),
            url: String(t.url ?? ""),
            content: String(t.content ?? ""),
            comment: String(replies[i]?.comment ?? "").trim(),
            quote: String(replies[i]?.quote ?? "").trim(),
          }))
          .filter((r) => r.comment || r.quote);
        if (!results.length) return json({ error: "El modelo devolvió una respuesta vacía" }, 502);
        return json({ replies: results, model });
      } catch (error) {
        return json({ error: "No se pudieron generar los comentarios", detail: [String(error)] }, 502);
      }
    }

    // Mode: technical blockchain guide, grounded on the chain's official docs.
    if (body.format === "guide") {
      const chainLabel = String(body.chain_label ?? "").trim();
      const docsUrl = String(body.docs_url ?? "").trim();
      const topic = String(body.topic ?? "").trim();
      const useEmojis = body.use_emojis === true;
      if (!chainLabel || !topic) return json({ error: "Falta la blockchain o el tema de la guía" }, 400);

      // The overused LLM emoji palette reads as AI-generated; if emojis are
      // on, restrict to plain functional ones instead.
      const emojiRule = useEmojis
        ? 'Podés usar emojis con criterio, máximo 1 por sección y nunca en el título. Prohibido el set típico de IA (🚀✨🔥💡🙌🎉👇🧵⚡🤖🔮💯🌟). Si usás alguno, que sea simple y funcional (✅ ❌ 💰 🔗 📊).'
        : "No uses ningún emoji en toda la guía.";

      const input = `Eres el equipo técnico editorial de Tellus Cooperative. Escribe una guía técnica profesional en Markdown sobre: "${topic}" para ${chainLabel}.

Usa Google Search y revisa la documentación oficial (${docsUrl}) para verificar cada detalle técnico: nombres de funciones, SDKs, parámetros, endpoints, versiones. NO inventes APIs ni parámetros que no existan; si no encuentras algo con certeza, dilo en vez de inventarlo.

Cita AL MENOS 2 fuentes reales y distintas (idealmente 2 a 4): la documentación oficial y al menos una fuente técnica adicional (blog oficial, changelog, repo de ejemplos, paper). Si no encontrás una segunda fuente confiable, seguí buscando antes de responder; no publiques con una sola fuente.

Cuando menciones una herramienta, librería o dato externo dentro del texto, agregá el hipervínculo real en el momento (formato [texto](url)), no solo al final en fuentes.

${emojiRule}

Formato obligatorio en Markdown:
# Título de la guía (claro, específico, con la keyword principal)
### Subtítulo: qué va a lograr el lector
**Nivel:** principiante, intermedio o avanzado

## Meta SEO
**Meta descripción:** 1 frase de 140 a 160 caracteres, natural, con la keyword principal, pensada para el snippet de buscadores.
**Palabras clave:** 5 a 8 palabras clave relevantes separadas por coma.

## TL;DR
2-3 frases que resuman la guía completa por sí solas (para que un buscador con IA pueda citarlas directamente sin leer el resto).

## Qué vas a lograr
2-3 líneas.

## Requisitos
Lista de lo que hace falta antes de empezar (SDK, cuenta, versión de lenguaje, etc.).

## Paso a paso
Desarrollo con subtítulos ##. CUANDO el paso involucre código, SIEMPRE incluye un bloque de código real y funcional en \`\`\`lenguaje (no pseudocódigo, no lo omitas).

## Errores comunes
2-4 errores típicos y cómo evitarlos.

## Cierre Tellus
1 párrafo breve conectando esto con la misión de Tellus Cooperative (infraestructura abierta, inclusión financiera).

---
**SOURCES**
Mínimo 2 links reales y distintos de la documentación oficial y otras fuentes que verificaste.

${styleRules(lang)}

Responde ÚNICAMENTE con la guía completa en Markdown, siguiendo exactamente ese formato, sin comentarios extra antes ni después.`;

      try {
        const { data, model } = await callGemini(apiKey, input);
        const draft = finalizeArticle(data, model, extractText(data), `Guía de ${chainLabel}`);

        // Grounding usually returns real citations, but guarantee the official
        // docs page is always counted as source #1 — it's always verifiable.
        if (!draft.sources.some((s) => s.url === docsUrl)) {
          draft.sources = [{ url: docsUrl, title: `Documentación oficial de ${chainLabel}` }, ...draft.sources];
        }

        // Best-effort image query in the guide's own language/topic (cheap,
        // no tools): lets the frontend fetch a photo that actually matches
        // the content instead of a generic "<chain> blockchain" stock shot.
        let imageQuery = "";
        try {
          const q = await callGemini(apiKey, `Da solo 3 a 6 palabras en inglés (sin comillas, sin explicación) que describan visualmente el tema de esta guía técnica para buscar una foto de stock relacionada: "${topic}" (${chainLabel}).`, false);
          imageQuery = extractText(q.data).trim().replace(/^["'.]|["'.]$/g, "").split("\n")[0].slice(0, 80);
        } catch { /* image query is optional polish, never block the guide on it */ }

        return json({ drafts: [draft], requested: 1, generated: 1, errors: [], imageQuery });
      } catch (error) {
        return json({ error: "No se pudo generar la guía", detail: [String(error)] }, 502);
      }
    }

    // Mode: X + Discord + LinkedIn posts for a published guide, professional
    // and technical tone (not the casual WhatsApp tone social_posts uses).
    if (body.format === "guide_posts") {
      const guide = body.guide as Record<string, unknown> | undefined;
      if (!guide || typeof guide !== "object" || !guide.title) return json({ error: "Falta la guía" }, 400);
      const link = String(body.link ?? "").trim();

      const input = `Eres el equipo técnico editorial de Tellus Cooperative. A partir de esta guía técnica ya publicada, escribe un post para cada canal, profesional y directo, sin hype. ${link ? `Cada post DEBE incluir este enlace a la guía: ${link}` : "Aún no hay enlace público: cierra cada post invitando a leer la guía completa, sin inventar links."}

Título: ${String(guide.title)}
Subtítulo: ${String(guide.subtitle ?? "")}

${styleRules(lang)}

Canales:
- x: <=270 caracteres, gancho técnico concreto (qué se puede construir/lograr), 1-2 hashtags.
- discord: 3-5 líneas para un canal de developers: contexto técnico, qué cubre la guía, invitación a preguntas; puede mencionar 1 dato técnico específico.
- linkedin: 3-5 párrafos cortos, tono profesional, enfocado en por qué importa para el ecosistema/negocio, cierre con invitación a leer.

Responde ÚNICAMENTE con un objeto JSON válido, sin bloques de código ni texto extra:
{"x": "post para X", "discord": "mensaje para Discord", "linkedin": "post para LinkedIn"}`;

      try {
        const { data, model } = await callGemini(apiKey, input, false);
        const parsed = parseJsonLoose(extractText(data));
        const posts = {
          x: String(parsed.x ?? "").trim(),
          discord: String(parsed.discord ?? "").trim(),
          linkedin: String(parsed.linkedin ?? "").trim(),
        };
        if (!posts.x && !posts.discord && !posts.linkedin) return json({ error: "El modelo devolvió una respuesta vacía" }, 502);
        return json({ posts, model });
      } catch (error) {
        return json({ error: "No se pudieron generar los posts de la guía", detail: [String(error)] }, 502);
      }
    }

    // Mode: rewrite a pasted article/source (any language) in Tellus's voice
    // and the team's own article template, no fresh search needed.
    if (body.format === "rewrite_article") {
      const sourceText = String(body.source_text ?? "").trim();
      if (!sourceText) return json({ error: "Falta el texto a reescribir" }, 400);
      let promptMd = typeof body.prompt_md === "string" ? body.prompt_md.trim() : "";
      if (!promptMd) {
        const key = typeof body.prompt_key === "string" ? body.prompt_key : "crypto";
        const { data: template } = await supabase.from("article_prompts").select("prompt_md").eq("key", key).maybeSingle();
        if (!template) return json({ error: `No existe la plantilla '${key}'` }, 400);
        promptMd = template.prompt_md;
      }
      try {
        const draft = await rewriteArticle(apiKey, promptMd, sourceText, lang);
        return json({ drafts: [draft], requested: 1, generated: 1, errors: [] });
      } catch (error) {
        return json({ error: "No se pudo reescribir el artículo", detail: [String(error)] }, 502);
      }
    }

    // Mode: social posts (X + WhatsApp + LinkedIn) for a published article,
    // each one carrying the Beehiiv link.
    if (body.format === "social_posts") {
      const article = body.article as Record<string, unknown> | undefined;
      if (!article || typeof article !== "object" || !article.title) return json({ error: "Falta el artículo" }, 400);
      // The Beehiiv link is optional: without it the posts simply tease the article.
      const link = String(body.link ?? "").trim();

      const summary = Array.isArray(article.summary) ? article.summary.map((s: unknown) => `- ${String(s)}`).join("\n") : "";
      const input = `Eres el equipo editorial de Tellus Cooperative. A partir de este artículo ya publicado, escribe un post para cada canal, claro y humano (sin hype ni tono trader). ${link ? `Cada post DEBE incluir este enlace al artículo: ${link}` : "Aún no hay enlace público: cierra cada post invitando a leer el artículo completo en el newsletter de Tellus, sin inventar links."}

Título: ${String(article.title)}
Subtítulo: ${String(article.subtitle ?? "")}
Resumen:
${summary}

${styleRules(lang)}

Reglas de estilo (obligatorias): tono profesional y editorial, como un medio serio. NADA de tono de guía, tutorial o vendedor. Máximo 1 emoji en total en todos los posts, e idealmente ninguno. Sin listas con viñetas ni "✅". Frases completas, directas, con datos del artículo.

Canales:
- x: <=280 caracteres, con gancho informativo, 1-2 hashtags máximo.
- whatsapp: 2-4 líneas sobrias y profesionales para compartir en grupos; sin emojis, sin mayúsculas de hype; termina con el enlace.
- linkedin: 3-5 párrafos cortos, tono profesional y cálido, sin emojis, cierre con invitación a leer el artículo.

Responde ÚNICAMENTE con un objeto JSON válido, sin bloques de código ni texto extra:
{"x": "post para X", "whatsapp": "mensaje para WhatsApp", "linkedin": "post para LinkedIn"}`;

      try {
        const { data, model } = await callGemini(apiKey, input, false);
        const parsed = parseJsonLoose(extractText(data));
        const posts = {
          x: String(parsed.x ?? "").trim(),
          whatsapp: String(parsed.whatsapp ?? "").trim(),
          linkedin: String(parsed.linkedin ?? "").trim(),
        };
        if (!posts.x && !posts.whatsapp && !posts.linkedin) return json({ error: "El modelo devolvió una respuesta vacía", detail: [extractText(data).slice(0, 300)] }, 502);
        return json({ posts, model });
      } catch (error) {
        return json({ error: "No se pudieron generar los posts", detail: [String(error)] }, 502);
      }
    }

    // Mode: caption a meme/GIF for each social channel.
    if (body.format === "meme_post") {
      const tema = String(body.tema ?? "").trim();
      const memeTitle = String(body.meme_title ?? "").trim();
      const caption = String(body.caption ?? "").trim();
      if (!tema && !memeTitle) return json({ error: "Falta el tema o el meme" }, 400);
      const input = `Eres el equipo editorial de Tellus Cooperative. Vamos a publicar un meme/GIF sobre "${tema || memeTitle}"${memeTitle ? ` (plantilla: "${memeTitle}")` : ""}${caption ? `. El texto del meme dice: "${caption}"` : ""}.

Escribe el texto que acompaña al meme en cada canal, con humor inteligente y liviano. NUNCA expliques el chiste. Sin tono de guía ni vendedor.

${styleRules(lang)}

Canales:
- x: <=250 caracteres, con gancho, 0-1 hashtag.
- whatsapp: 1-2 líneas sobrias para compartir en grupos, sin emojis.
- instagram: caption de 2-3 líneas + 3-5 hashtags al final.

Responde ÚNICAMENTE con un objeto JSON válido, sin bloques de código ni texto extra:
{"x": "texto para X", "whatsapp": "texto para WhatsApp", "instagram": "caption para Instagram"}`;
      try {
        const { data, model } = await callGemini(apiKey, input, false);
        const parsed = parseJsonLoose(extractText(data));
        const posts = {
          x: String(parsed.x ?? "").trim(),
          whatsapp: String(parsed.whatsapp ?? "").trim(),
          instagram: String(parsed.instagram ?? "").trim(),
        };
        if (!posts.x && !posts.whatsapp && !posts.instagram) return json({ error: "El modelo devolvió una respuesta vacía" }, 502);
        return json({ posts, model });
      } catch (error) {
        return json({ error: "No se pudo generar el post del meme", detail: [String(error)] }, 502);
      }
    }

    // Mode: Tellus-voice posts about a searched topic, grounded on the real
    // tweets the feed just captured. No tools: fast and quota-free.
    if (body.format === "topic_posts") {
      const query = String(body.query ?? "").trim();
      if (!query) return json({ error: "Falta query" }, 400);
      const samples = Array.isArray(body.posts)
        ? body.posts.slice(0, 10).map((p: unknown) => `- ${String(p).slice(0, 280)}`).join("\n")
        : "";
      const input = `Eres el equipo editorial de Tellus Cooperative. Tema buscado: "${query}".

Posts reales que circulan ahora en X sobre el tema:
${samples || "(sin ejemplos)"}

Escribe 3 posts LISTOS para publicar en X con la voz de Tellus, <=270 caracteres cada uno. Aporta ángulo propio, no repitas los posts de arriba.

${viralStyle(lang)}

${styleRules(lang)}

Mezcla: el post 1 usa el formato viral de arriba; los posts 2 y 3 son sobrios y editoriales (gancho informativo, sin mayúsculas sostenidas).

Responde ÚNICAMENTE con un objeto JSON válido, sin bloques de código ni texto extra:
{"posts": ["post 1 viral", "post 2 sobrio", "post 3 sobrio"], "gif_busqueda": "2-3 palabras en inglés para buscar el GIF/imagen perfecto para estos posts"}`;
      try {
        const { data, model } = await callGemini(apiKey, input, false);
        const parsed = parseJsonLoose(extractText(data));
        const posts = Array.isArray(parsed.posts) ? parsed.posts.map((p: unknown) => String(p)).filter(Boolean) : [];
        if (!posts.length) return json({ error: "El modelo devolvió una respuesta vacía" }, 502);
        return json({ posts, gifQuery: String(parsed.gif_busqueda ?? "").trim(), model });
      } catch (error) {
        return json({ error: "No se pudieron generar los posts del tema", detail: [String(error)] }, 502);
      }
    }

    // Mode: X post about a repo (from the Repos finder).
    if (body.format === "x_post") {
      if (!body.repo || typeof body.repo !== "object") return json({ error: "Falta el repositorio" }, 400);
      try {
        const draft = await generatePost(apiKey, body.repo as RepoContext, lang);
        return json({ drafts: [draft], requested: 1, generated: 1, errors: [] });
      } catch (error) {
        return json({ error: "No se pudo generar el post", detail: [String(error)] }, 502);
      }
    }

    // Mode: one post per channel about a repo — X, WhatsApp, Discord, LinkedIn, Instagram.
    if (body.format === "repo_social_posts") {
      if (!body.repo || typeof body.repo !== "object") return json({ error: "Falta el repositorio" }, 400);
      try {
        const result = await generateRepoSocialPosts(apiKey, body.repo as RepoContext, lang);
        return json(result);
      } catch (error) {
        return json({ error: "No se pudieron generar los posts", detail: [String(error)] }, 502);
      }
    }

    const count = Math.max(1, Math.min(5, Number(body.count) || 1));
    const date = typeof body.date === "string" && body.date ? body.date : yesterdayISO();

    // Prompt: explicit text wins; otherwise load the template by key (RLS-scoped).
    let promptMd = typeof body.prompt_md === "string" ? body.prompt_md.trim() : "";
    if (!promptMd) {
      const key = typeof body.prompt_key === "string" ? body.prompt_key : "crypto";
      const { data: template } = await supabase
        .from("article_prompts")
        .select("prompt_md")
        .eq("key", key)
        .maybeSingle();
      if (!template) return json({ error: `No existe la plantilla '${key}'` }, 400);
      promptMd = template.prompt_md;
    }

    // Generate sequentially: independent calls give varied drafts and keep
    // Gemini rate limits happy.
    const drafts: Draft[] = [];
    const errors: string[] = [];
    for (let i = 0; i < count; i += 1) {
      try {
        drafts.push(await generateOne(apiKey, promptMd, date, lang));
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    if (!drafts.length) return json({ error: "No se pudo generar ningún artículo", detail: errors }, 502);
    return json({ drafts, date, requested: count, generated: drafts.length, errors });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Error de generación" }, 500);
  }
});
