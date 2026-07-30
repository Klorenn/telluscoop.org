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

// Stage 1 of the pipeline: fix editorial intent BEFORE research/writing
// happens, instead of letting the model improvise audience/scope. All
// fields are optional — an empty brief renders to "".
interface EditorialBrief {
  audience?: string;
  level?: string;
  platform?: string;
  maxWords?: number;
  objective?: string;
  readerOutcome?: string;
}

function readBrief(value: unknown): EditorialBrief {
  if (!value || typeof value !== "object") return {};
  const b = value as Record<string, unknown>;
  return {
    audience: typeof b.audience === "string" ? b.audience.trim() : undefined,
    level: typeof b.level === "string" ? b.level.trim() : undefined,
    platform: typeof b.platform === "string" ? b.platform.trim() : undefined,
    maxWords: Number(b.maxWords) > 0 ? Number(b.maxWords) : undefined,
    objective: typeof b.objective === "string" ? b.objective.trim() : undefined,
    readerOutcome: typeof b.readerOutcome === "string" ? b.readerOutcome.trim() : undefined,
  };
}

function editorialBriefRules(brief: EditorialBrief): string {
  const lines: string[] = [];
  if (brief.audience) lines.push(`Audiencia exacta: ${brief.audience}.`);
  if (brief.level) lines.push(`Nivel técnico del lector: ${brief.level}.`);
  if (brief.platform) lines.push(`Plataforma de destino: ${brief.platform}.`);
  if (brief.maxWords) lines.push(`Extensión MÁXIMA: ${brief.maxWords} palabras. Si no alcanzás a cubrir todo en ese límite, prioriza profundidad sobre cobertura, no lo excedas.`);
  if (brief.objective) lines.push(`Objetivo del artículo: ${brief.objective}.`);
  if (brief.readerOutcome) lines.push(`Después de leerlo, el lector debe poder: ${brief.readerOutcome}.`);
  if (!lines.length) return "";
  return `\nDefinición editorial (obligatoria, fijada ANTES de investigar — no te apartes de esto):\n${lines.map((l) => `- ${l}`).join("\n")}\n`;
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
- First line: hook with the strongest concrete fact, written normally (sentence case, only the first letter and proper nouns capitalized) — NEVER in all caps.
- Second line: 1 short line of context, lowercase.
- Then 3-4 bullets starting with "→ " (results, numbers, concrete features).
- Close with 1 short punchy line.
- Only real facts from the given context, NOTHING invented. Short sentences. At most 1 emoji or none. At most 1 hashtag.`;
  }
  return `Formato viral para X (estilo cuentas grandes de IA):
- Primera línea: gancho con el dato más fuerte y concreto, escrito normal (mayúscula solo al inicio y en nombres propios) — NUNCA todo en mayúsculas.
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
  checks?: DraftChecks;
}

interface RepoContext {
  full_name?: string;
  description?: string;
  url?: string;
  language?: string;
  stars?: number;
  archived?: boolean;
}

function archivedNote(repo: RepoContext): string {
  return repo.archived
    ? "\nADVERTENCIA: este repositorio está ARCHIVADO en GitHub (ya no recibe cambios). Menciónalo explícitamente en el post (ej: \"proyecto archivado\", \"ya no mantenido\"); no lo presentes como activo."
    : "";
}

interface VerifiedRepo {
  full_name: string;
  html_url: string;
  description: string | null;
  owner_login: string | null;
  archived: boolean;
  license: string | null;
  pushed_at: string | null;
  stargazers_count: number;
  verified_at: string;
}

// Re-checks the repo against the real GitHub API (GITHUB_TOKEN secret, never
// exposed to the browser) right before writing about it — the frontend's repo
// object can be stale (from a search done minutes/days earlier). Returns null
// if the repo doesn't exist anymore (renamed/deleted): callers must refuse to
// write about a repo they can't verify, never invent the missing fields.
async function verifyGithubRepo(fullName: string): Promise<VerifiedRepo | null> {
  try {
    const token = Deno.env.get("GITHUB_TOKEN");
    const response = await fetch(`https://api.github.com/repos/${fullName}`, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "tellus-social-ops",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!response.ok) return null;
    const repo = await response.json();
    return {
      full_name: String(repo.full_name ?? fullName),
      html_url: String(repo.html_url ?? `https://github.com/${fullName}`),
      description: repo.description ?? null,
      owner_login: repo.owner?.login ?? null,
      archived: repo.archived === true,
      license: repo.license?.spdx_id ?? null,
      pushed_at: repo.pushed_at ?? null,
      stargazers_count: Number(repo.stargazers_count) || 0,
      verified_at: new Date().toISOString().slice(0, 10),
    };
  } catch {
    return null;
  }
}

// Repo grounding for guides: before writing, find real GitHub repos related
// to the topic (Gemini + Google Search, same approach as the Repos finder in
// Stellar Ops) and verify each one against the real GitHub API (GITHUB_TOKEN
// secret) so the guide cites real projects with real star counts instead of
// inventing names or numbers.
async function findGuideRepoCandidates(topic: string, chainLabel: string, apiKey: string): Promise<string[]> {
  try {
    const input = `Busca en Google qué repositorios de GitHub son relevantes o se mencionan en relación a "${topic}" (contexto: ${chainLabel}). Prioriza los más conocidos, mantenidos y con más estrellas. Solo repos reales que existan hoy en github.com, sin inventar.

Responde ÚNICAMENTE con un objeto JSON válido, sin bloques de código ni texto extra:
{"repos": [{"full_name": "owner/repo"}]}`;
    const { data } = await callGemini(apiKey, input);
    const text = extractText(data).replace(/```json|```/g, "").trim();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end <= start) return [];
    const parsed = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    const repos = Array.isArray(parsed.repos) ? parsed.repos as Record<string, unknown>[] : [];
    const names = repos.map((r) => String(r.full_name ?? "").trim()).filter((n) => /^[\w.-]+\/[\w.-]+$/.test(n));
    return [...new Set(names)].slice(0, 8);
  } catch {
    return [];
  }
}

function reposContextBlock(repos: VerifiedRepo[]): string {
  if (!repos.length) return "";
  const lines = repos.map((r) => `- ${r.full_name} (${r.stargazers_count}★${r.archived ? ", ARCHIVADO" : ""}${r.license ? `, licencia ${r.license}` : ""}): ${r.description ?? "sin descripción"} — ${r.html_url}`).join("\n");
  return `\nRepos reales verificados en GitHub sobre este tema (datos exactos vía GitHub API, no los cambies): \n${lines}\nSi mencionas alguno, usa su link y su cifra de estrellas TAL CUAL aparece arriba. No inventes otros repos ni cifras; si necesitas uno que no está en la lista, verifícalo con Google Search primero.\n`;
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

// ---------- Stage 4: technical control checklist ----------
// Deterministic, non-LLM checks run on every finished long-form draft
// (article/rewrite/guide): every link actually responds, no GitHub repo is
// archived without a warning already in the text, and no secret-looking
// string slipped in. Runs AFTER generation and never blocks the response —
// it attaches a `checks` report so the UI can flag what needs a human look,
// per rule 12 ("si no se puede comprobar, indícalo, no lo completes por
// inferencia").

interface LinkCheck { url: string; ok: boolean; status?: number; error?: string }

async function checkLink(url: string): Promise<LinkCheck> {
  const headers = { "User-Agent": "Mozilla/5.0 (compatible; TellusVerifyBot/1.0; +https://telluscoop.org)" };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    let response = await fetch(url, { method: "HEAD", redirect: "follow", headers, signal: controller.signal }).catch(() => null);
    if (!response || (!response.ok && response.status !== 405)) {
      response = await fetch(url, { method: "GET", redirect: "follow", headers, signal: controller.signal }).catch(() => response);
    }
    clearTimeout(timer);
    if (!response) return { url, ok: false, error: "sin respuesta" };
    return { url, ok: response.ok, status: response.status };
  } catch (error) {
    return { url, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function extractMarkdownLinks(text: string): string[] {
  const urls = new Set<string>();
  for (const match of text.matchAll(/\[[^\]]+\]\((https?:\/\/[^)\s]+)\)/g)) urls.add(match[1]);
  return [...urls];
}

const GITHUB_REPO_RE = /github\.com\/([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)\/([a-zA-Z0-9._-]+)/g;

function extractGithubReposFromText(text: string): string[] {
  const names = new Set<string>();
  for (const match of text.matchAll(GITHUB_REPO_RE)) {
    const repo = match[2].replace(/\.git$/i, "").replace(/[.,)]+$/, "");
    if (repo) names.add(`${match[1]}/${repo}`);
  }
  return [...names];
}

// Not a substitute for a real secret scanner — a last line of defense
// against the model pasting something that looks like a real credential.
const SECRET_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "AWS access key", re: /AKIA[0-9A-Z]{16}/ },
  { name: "bloque de clave privada", re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "Stripe secret key", re: /\bsk_(live|test)_[0-9a-zA-Z]{16,}/ },
  { name: "GitHub token", re: /\bgh[pousr]_[0-9A-Za-z]{20,}/ },
  { name: "posible frase semilla", re: /\b(?:seed phrase|mnemonic|frase semilla)\b[^.\n]{0,80}/i },
  { name: "credencial genérica en texto", re: /(api[_-]?key|secret|token|password)\s*[:=]\s*["'][A-Za-z0-9_\-]{16,}["']/i },
];

interface DraftChecks {
  linksChecked: number;
  brokenLinks: LinkCheck[];
  archivedRepos: string[];
  secretFindings: string[];
  allLinksOk: boolean;
  hasSecrets: boolean;
  checkedAt: string;
}

async function verifyDraft(bodyMd: string): Promise<DraftChecks> {
  const links = extractMarkdownLinks(bodyMd).slice(0, 15);
  const linkChecks = await Promise.all(links.map(checkLink));
  const repoNames = extractGithubReposFromText(bodyMd).slice(0, 10);
  const repoChecks = await Promise.all(repoNames.map(verifyGithubRepo));
  const archivedRepos = repoChecks
    .filter((r): r is VerifiedRepo => r !== null && r.archived)
    .filter((r) => !new RegExp(`archiv`, "i").test(bodyMd.split(r.full_name)[1]?.slice(0, 120) ?? ""))
    .map((r) => r.full_name);
  const secretFindings = SECRET_PATTERNS.filter((p) => p.re.test(bodyMd)).map((p) => p.name);
  return {
    linksChecked: linkChecks.length,
    brokenLinks: linkChecks.filter((l) => !l.ok),
    archivedRepos,
    secretFindings,
    allLinksOk: linkChecks.every((l) => l.ok),
    hasSecrets: secretFindings.length > 0,
    checkedAt: new Date().toISOString().slice(0, 10),
  };
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

  // Rule 10 of the technical-control checklist: every technical article
  // carries a visible verification date instead of pretending it was checked
  // once and stays true forever.
  const bodyWithFooter = `${text}\n\n*Verificado el: ${new Date().toISOString().slice(0, 10)}*`;

  return { title: title || fallbackTitle, subtitle, summary: [], body_md: bodyWithFooter, sources, model };
}

async function generateOne(apiKey: string, promptMd: string, date: string, lang: Lang, brief: EditorialBrief = {}): Promise<Draft> {
  // The user's prompt template defines the full article format — the model
  // returns the complete Markdown untouched; title/subtitle are read from it.
  const input = `${promptMd}\n\nResume lo ocurrido el día anterior: ${date}. Usa Google Search para verificar cada hecho y cita fuentes reales y recientes. Fecha de publicación: hoy.
${editorialBriefRules(brief)}
${styleRules(lang)}

${inlineLinkRules(lang)}

Responde ÚNICAMENTE con el artículo completo en Markdown, siguiendo exactamente el formato del prompt, sin comentarios extra antes ni después.`;

  const { data, model } = await callGemini(apiKey, input);
  const draft = finalizeArticle(data, model, extractText(data), "Artículo del día");
  draft.checks = await verifyDraft(draft.body_md);
  return draft;
}

async function rewriteArticle(apiKey: string, promptMd: string, sourceText: string, lang: Lang, brief: EditorialBrief = {}): Promise<Draft> {
  // No fresh search: the source material (any language) already has the facts.
  // The model translates/rewrites into Tellus's voice and the user's template.
  const input = `${promptMd}

No hagas una búsqueda nueva de noticias. Reescribe el siguiente material fuente con la voz y el formato de arriba, usando SOLO los hechos que contiene (puede venir en cualquier idioma; tradúcelo si hace falta):

"""
${sourceText.slice(0, 12000)}
"""
${editorialBriefRules(brief)}
${styleRules(lang)}

${inlineLinkRules(lang)}

Responde ÚNICAMENTE con el artículo completo en Markdown, siguiendo exactamente el formato del prompt, sin comentarios extra antes ni después.`;

  const { data, model } = await callGemini(apiKey, input, false);
  const draft = finalizeArticle(data, model, extractText(data), "Artículo reescrito");
  draft.checks = await verifyDraft(draft.body_md);
  return draft;
}

async function generatePost(apiKey: string, repo: RepoContext, lang: Lang): Promise<Draft> {
  const input = `Escribe un post para X (Twitter) con la voz editorial de Tellus Cooperative sobre este repositorio de GitHub.

Repositorio: ${repo.full_name ?? ""}
Descripción: ${repo.description ?? ""}
Lenguaje: ${repo.language ?? ""}
Estrellas: ${repo.stars ?? ""}
Enlace: ${repo.url ?? ""}
${archivedNote(repo)}
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
${archivedNote(repo)}
Usa Google Search para entender qué hace el proyecto y por qué es interesante antes de escribir.

${styleRules(lang)}

Canales:
- x: post principal SIN el link del repo (el link va en el segundo tweet). Formato obligatorio, igual a este ejemplo:
"Envío de ayuda humanitaria directa con blockchain.
Soter (27 estrellas) usa @StellarOrg y AI para enviar ayuda directo.
→ Donantes y ONGs crean links de cobro fáciles.
→ La IA verifica necesidades en privado.
→ Impacto on-chain, privacidad total.
Súmate a construir el futuro

¿Cómo lo logra? Soter usa Smart Contracts de Soroban para crear \\"claim links\\" simples. Las ONGs y donantes generan estos enlaces, y una IA verifica de forma privada las necesidades, asegurando una distribución justa y eficiente."
OJO: ese ejemplo es de un repo blockchain, pero es SOLO un ejemplo de FORMATO — el formato aplica a CUALQUIER repo (IA, dev tools, UI, scraping, lo que sea) adaptando el contenido al dominio real del repo. Estructura: 1) gancho normal (mayúscula solo al inicio y en nombres propios, NUNCA todo en mayúsculas) sobre lo que hace el repo, 2) línea "Nombre (N estrellas) usa/hace X para Y" — menciona la @cuenta de X del proyecto o ecosistema SOLO si existe y la conoces con certeza (ej: @StellarOrg, @OpenAI); si no, omite la mención, 3) 3 bullets "→ " con lo concreto, 4) cierre corto invitando a la acción, 5) párrafo final "¿Cómo lo logra? ..." explicando la técnica en 2-3 frases. Solo datos reales del repo.
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
      const category = body.category === "agent" ? "agent" : "blockchain";
      if (!chainLabel || !topic) return json({ error: "Falta la blockchain o el tema de la guía" }, 400);

      // The overused LLM emoji palette reads as AI-generated; if emojis are
      // on, restrict to plain functional ones instead.
      const emojiRule = useEmojis
        ? 'Podés usar emojis con criterio, máximo 1 por sección y nunca en el título. Prohibido el set típico de IA (🚀✨🔥💡🙌🎉👇🧵⚡🤖🔮💯🌟). Si usás alguno, que sea simple y funcional (✅ ❌ 💰 🔗 📊).'
        : "No uses ningún emoji en toda la guía.";
      const brief = readBrief(body.brief);

      const candidateRepos = await findGuideRepoCandidates(topic, chainLabel, apiKey);
      const verifiedRepos = (await Promise.all(candidateRepos.map(verifyGithubRepo))).filter((r): r is VerifiedRepo => r !== null);

      const input = `Eres el equipo técnico editorial de Tellus Cooperative. Escribe una guía técnica profesional en Markdown sobre: "${topic}" para ${chainLabel}.
${editorialBriefRules(brief)}

Usa Google Search y revisa la documentación oficial (${docsUrl}) para verificar cada detalle técnico: nombres de funciones, SDKs, parámetros, endpoints, versiones. NO inventes APIs ni parámetros que no existan; si no encuentras algo con certeza, dilo en vez de inventarlo.

Cita AL MENOS 2 fuentes reales y distintas (idealmente 2 a 4): la documentación oficial y al menos una fuente técnica adicional (blog oficial, changelog, repo de ejemplos, paper). Si no encontrás una segunda fuente confiable, seguí buscando antes de responder; no publiques con una sola fuente.

Cuando menciones una herramienta, librería o dato externo dentro del texto, agregá el hipervínculo real en el momento (formato [texto](url)), no solo al final en fuentes.
${reposContextBlock(verifiedRepos)}
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
1 párrafo breve conectando esto con la misión de Tellus Cooperative (${category === "agent" ? "herramientas abiertas para builders, IA aplicada a construir más rápido" : "infraestructura abierta, inclusión financiera"}).

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
        draft.checks = await verifyDraft(draft.body_md);

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
        const draft = await rewriteArticle(apiKey, promptMd, sourceText, lang, readBrief(body.brief));
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
- x: <=280 caracteres, con gancho informativo, 1-2 hashtags máximo, CIERRA con una pregunta abierta al lector (no retórica vacía — una pregunta real sobre el tema del artículo).
- whatsapp: 2-4 líneas sobrias y profesionales para compartir en grupos; sin emojis, sin mayúsculas de hype; termina con el enlace.
- linkedin: 3-5 párrafos cortos, tono profesional y cálido, sin emojis, cierre con invitación a leer el artículo.
- promo: post promocional INDEPENDIENTE de los anteriores (no es un resumen del artículo) — pensado como si fuera un anuncio/teaser standalone, gancho fuerte, <=280 caracteres, mismo enlace.

Además:
- image_proposal: 3-6 palabras en inglés (sin comillas) que describan visualmente una imagen de portada adecuada para este artículo, para buscar una foto de stock relacionada.
- quotable_lines: exactamente 3 frases cortas y potentes extraídas o adaptadas del artículo, cada una lista para publicarse SOLA como post (sin contexto adicional necesario).

Responde ÚNICAMENTE con un objeto JSON válido, sin bloques de código ni texto extra:
{"x": "post para X", "whatsapp": "mensaje para WhatsApp", "linkedin": "post para LinkedIn", "promo": "post promocional independiente", "image_proposal": "3-6 palabras en inglés", "quotable_lines": ["frase 1", "frase 2", "frase 3"]}`;

      try {
        const { data, model } = await callGemini(apiKey, input, false);
        const parsed = parseJsonLoose(extractText(data));
        const posts = {
          x: String(parsed.x ?? "").trim(),
          whatsapp: String(parsed.whatsapp ?? "").trim(),
          linkedin: String(parsed.linkedin ?? "").trim(),
          promo: String(parsed.promo ?? "").trim(),
        };
        const imageProposal = String(parsed.image_proposal ?? "").trim();
        const quotableLines = Array.isArray(parsed.quotable_lines) ? parsed.quotable_lines.map((q: unknown) => String(q)).filter(Boolean).slice(0, 3) : [];
        if (!posts.x && !posts.whatsapp && !posts.linkedin) return json({ error: "El modelo devolvió una respuesta vacía", detail: [extractText(data).slice(0, 300)] }, 502);
        return json({ posts, imageProposal, quotableLines, model });
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
      const repo = body.repo as RepoContext;
      if (!repo.full_name) return json({ error: "Falta el nombre del repositorio (owner/repo)" }, 400);
      const verified = await verifyGithubRepo(repo.full_name);
      if (!verified) return json({ error: `No pudimos verificar ${repo.full_name} en GitHub. Puede haber sido renombrado o eliminado — revisalo antes de publicar.` }, 422);
      try {
        const draft = await generatePost(apiKey, { ...repo, description: verified.description ?? repo.description, stars: verified.stargazers_count, archived: verified.archived }, lang);
        return json({ drafts: [draft], requested: 1, generated: 1, errors: [], verified });
      } catch (error) {
        return json({ error: "No se pudo generar el post", detail: [String(error)] }, 502);
      }
    }

    // Mode: one post per channel about a repo — X, WhatsApp, Discord, LinkedIn, Instagram.
    if (body.format === "repo_social_posts") {
      if (!body.repo || typeof body.repo !== "object") return json({ error: "Falta el repositorio" }, 400);
      const repo = body.repo as RepoContext;
      if (!repo.full_name) return json({ error: "Falta el nombre del repositorio (owner/repo)" }, 400);
      const verified = await verifyGithubRepo(repo.full_name);
      if (!verified) return json({ error: `No pudimos verificar ${repo.full_name} en GitHub. Puede haber sido renombrado o eliminado — revisalo antes de publicar.` }, 422);
      try {
        const result = await generateRepoSocialPosts(apiKey, { ...repo, description: verified.description ?? repo.description, stars: verified.stargazers_count, archived: verified.archived }, lang);
        return json({ ...result, verified });
      } catch (error) {
        return json({ error: "No se pudieron generar los posts", detail: [String(error)] }, 502);
      }
    }

    const count = Math.max(1, Math.min(5, Number(body.count) || 1));
    const date = typeof body.date === "string" && body.date ? body.date : yesterdayISO();
    const brief = readBrief(body.brief);

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
        drafts.push(await generateOne(apiKey, promptMd, date, lang, brief));
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
