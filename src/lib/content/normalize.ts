/**
 * Normaliza el HTML "estilo email" de Beehiiv a HTML semántico y limpio:
 * - elimina el H1 duplicado (y el subtítulo repetido) al inicio del cuerpo
 * - convierte cualquier otro H1 en H2 (un solo H1 por página)
 * - elimina estilos inline, clases, spans de presentación, formularios/popups de suscripción,
 *   scripts, botones, encuestas y bloques de recomendaciones
 * - convierte las "generic embeds" de Beehiiv en tarjetas de enlace simples
 * - asigna ids a H2/H3 y devuelve una tabla de contenidos
 */
import * as cheerio from "cheerio";
import type { TocItem } from "./types";
import { slugify } from "./slugs";

type CheerioAPI = cheerio.CheerioAPI;

const ALLOWED_TAGS = new Set([
  "p", "h2", "h3", "h4", "ul", "ol", "li", "a", "strong", "em", "b", "i", "u", "s", "code", "pre",
  "blockquote", "figure", "figcaption", "img", "hr", "br", "sup", "sub", "table", "thead", "tbody",
  "tr", "th", "td", "iframe",
]);
const ALLOWED_ATTRS: Record<string, string[]> = {
  a: ["href", "class", "target", "rel"],
  img: ["src", "srcset", "sizes", "alt", "loading", "decoding", "width", "height"],
  iframe: ["src", "title", "allow", "allowfullscreen", "loading"],
  h2: ["id"],
  h3: ["id"],
  span: ["class"],
  div: ["class"],
  th: ["colspan", "rowspan"],
  td: ["colspan", "rowspan"],
};
const IFRAME_OK = /^(https:)?\/\/(www\.)?(youtube\.com|youtube-nocookie\.com|player\.vimeo\.com|open\.spotify\.com|platform\.twitter\.com|w\.soundcloud\.com)\//;

const norm = (s: string) => s.normalize("NFC").replace(/[\s\u200b]+/g, " ").trim().toLowerCase().replace(/[^\p{L}\p{N} ]/gu, "").replace(/ +/g, " ").trim();

/** Reescribe imágenes de Beehiiv al CDN con redimensionado (máx. 1400px, formato automático). */
export function beehiivImage(url: string, width = 1400): string {
  if (!url) return url;
  const m = url.match(/(?:beehiiv-images-production\.s3\.amazonaws\.com|media\.beehiiv\.com\/cdn-cgi\/image\/[^/]+)\/(uploads\/.+)$/);
  if (!m) return url;
  const path = m[1].replace(/\?.*$/, "");
  return `https://media.beehiiv.com/cdn-cgi/image/format=auto,width=${width},quality=72/${path}`;
}

export interface NormalizeResult {
  html: string;
  toc: TocItem[];
  text: string;
}

export function normalizeBeehiivHtml(
  raw: string,
  opts: { title: string; subtitle?: string }
): NormalizeResult {
  const $: CheerioAPI = cheerio.load(`<div id="root">${raw}</div>`, null, false);
  const root = $("#root");

  // 1) Basura evidente
  root.find("script, style, noscript, form, input, button, svg, select, textarea, source, template").remove();
  root.find('[data-subscribe], [class*="subscribe"], [class*="recommend"], [data-poll], [class*="poll"], [class*="advert"], [data-ad]').remove();

  // 2) Generic embeds -> tarjeta de enlace
  root.find('[data-generic-embed-container]').each((_, el) => {
    const e = $(el);
    const href = e.find("a").first().attr("href") || "#";
    const title = e.find("[data-generic-embed-title]").text().trim();
    const desc = e.find("[data-generic-embed-description]").text().trim();
    const host = e.find("[data-generic-embed-host]").text().trim();
    const img = e.find("img").first().attr("src");
    const card = $("<a></a>").attr("href", href).attr("class", "embed-card");
    const body = $('<span class="embed-body"></span>');
    if (title) body.append($('<span class="embed-title"></span>').text(title));
    if (desc) body.append($('<span class="embed-desc"></span>').text(desc));
    if (host) body.append($('<span class="embed-host"></span>').text(host.replace(/^https?:\/\//, "").split("/")[0]));
    card.append(body);
    if (img) card.append($("<img>").attr("src", img).attr("alt", ""));
    e.replaceWith(card);
  });

  // 3) <picture> -> <img>
  root.find("picture").each((_, el) => {
    const img = $(el).find("img").first();
    if (img.length) $(el).replaceWith(img);
    else $(el).remove();
  });

  // 4) H1 duplicado + subtítulo repetido al inicio
  const t = norm(opts.title);
  root.find("h1").each((idx, el) => {
    const h = $(el);
    if (norm(h.text()) === t) h.remove();
    else h.replaceWith($("<h2></h2>").html(h.html() || ""));
  });
  // Algunos posts repiten el título como H2/H3 en el primer bloque
  const firstHeading = root.find("h2, h3").first();
  if (firstHeading.length && norm(firstHeading.text()) === t) firstHeading.remove();
  if (opts.subtitle) {
    const sub = norm(opts.subtitle);
    root.find("p").slice(0, 3).each((_, el) => {
      if (norm($(el).text()) === sub) $(el).remove();
    });
  }

  // 5) Imágenes: CDN con tamaño, lazy
  root.find("img").each((_, el) => {
    const img = $(el);
    const src = img.attr("src") || "";
    if (!src) return void img.remove();
    img.attr("src", beehiivImage(src, 1400));
    if (beehiivImage(src) !== src) {
      img.attr("srcset", [480, 800, 1100, 1400].map((w) => `${beehiivImage(src, w)} ${w}w`).join(", "));
      img.attr("sizes", "(min-width: 760px) 700px, calc(100vw - 40px)");
    }
    img.attr("loading", "lazy");
    img.attr("decoding", "async");
  });

  // 6) iframes: solo proveedores conocidos
  root.find("iframe").each((_, el) => {
    const src = $(el).attr("src") || "";
    if (!IFRAME_OK.test(src)) $(el).remove();
    else $(el).attr("loading", "lazy");
  });

  // 7) Desenvolver todo lo no permitido (span/div/section...), limpiar atributos
  const unwrapAll = () => {
    let changed = true;
    while (changed) {
      changed = false;
      root.find("*").each((_, el) => {
        const node = el as unknown as { tagName?: string };
        const tag = (node.tagName || "").toLowerCase();
        const e = $(el);
        const cls = e.attr("class") || "";
        const keepClass = /^embed-(card|body|title|desc|host)$/.test(cls);
        if (!ALLOWED_TAGS.has(tag) && !keepClass) {
          e.replaceWith(e.contents());
          changed = true;
          return false; // reiniciar recorrido (el DOM cambió)
        }
      });
    }
  };
  unwrapAll();

  root.find("*").each((_, el) => {
    const node = el as unknown as { tagName?: string; attribs?: Record<string, string> };
    const tag = (node.tagName || "").toLowerCase();
    const allowed = ALLOWED_ATTRS[tag] || [];
    for (const name of Object.keys(node.attribs || {})) {
      if (!allowed.includes(name)) $(el).removeAttr(name);
    }
    const cls = $(el).attr("class");
    if (cls && !/^embed-(card|body|title|desc|host)$/.test(cls)) $(el).removeAttr("class");
  });

  // 8) Enlaces externos y UTM de Beehiiv
  root.find("a").each((_, el) => {
    const a = $(el);
    let href = a.attr("href") || "";
    href = href.replace(/[?&]utm_(source|medium|campaign)=[^&]*/g, "").replace(/\?&/, "?").replace(/\?$/, "");
    href = href.replace(/^https?:\/\/(blog\.telluscoop\.com|telluscoop\.beehiiv\.com)(?=\/)/, "");
    a.attr("href", href);
    if (/^https?:\/\//.test(href)) {
      a.attr("target", "_blank");
      a.attr("rel", "noopener noreferrer");
    } else {
      a.removeAttr("target");
      a.removeAttr("rel");
    }
  });

  // 9) Párrafos vacíos, <br> sobrantes
  root.find("p, li, h2, h3, h4, strong, em").each((_, el) => {
    const e = $(el);
    if (!e.text().trim() && !e.find("img, iframe").length) e.remove();
  });

  // 10) TOC
  const toc: TocItem[] = [];
  const used = new Set<string>();
  root.find("h2, h3").each((_, el) => {
    const e = $(el);
    const text = e.text().replace(/\s+/g, " ").trim();
    let id = slugify(text).slice(0, 60) || "seccion";
    while (used.has(id)) id += "-2";
    used.add(id);
    e.attr("id", id);
    toc.push({ id, text, level: (el as unknown as { tagName: string }).tagName === "h2" ? 2 : 3 });
  });

  const html = (root.html() || "").replace(/>\s+</g, "> <").replace(/\s{2,}/g, " ").trim();
  const text = root.text().replace(/\s+/g, " ").trim();
  return { html, toc, text };
}
