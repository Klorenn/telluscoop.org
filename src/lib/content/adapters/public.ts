/**
 * Adaptador "public": lee los posts públicos de blog.telluscoop.com (Beehiiv)
 * SIN credenciales: sitemap.xml -> cada /p/<slug> -> JSON embebido
 * (window.__remixContext, metadatos del post) + HTML de #content-blocks.
 * Solo hace GET de páginas públicas; no modifica nada en Beehiiv.
 */
import * as cheerio from "cheerio";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Author, ContentAdapter, ContentSnapshot, Post, Publication, Tag } from "../types";
import { normalizeBeehiivHtml } from "../normalize";
import { looksBroken, repairByWords, repairSlug, slugify } from "../slugs";

const UA = "Mozilla/5.0 (TellusPrototype content sync; read-only)";

export interface PublicAdapterOptions {
  baseUrl?: string;
  /** Carpeta para caché por post (HTML crudo ya normalizado) entre builds. */
  cacheDir?: string;
  concurrency?: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type BeehiivPost = any;

async function get(url: string, tries = 3): Promise<string> {
  for (let n = 1; ; n++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html,application/xml" } });
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return await res.text();
    } catch (e) {
      if (n >= tries) throw e;
      await new Promise((r) => setTimeout(r, 800 * n));
    }
  }
}

function extractRemix(html: string): any | null {
  const marker = "window.__remixContext = ";
  const i = html.indexOf(marker);
  if (i < 0) return null;
  const j = html.indexOf(";</script>", i);
  try {
    return JSON.parse(html.slice(i + marker.length, j));
  } catch {
    return null;
  }
}

async function pool<T, R>(items: T[], n: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let k = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (k < items.length) {
        const i = k++;
        out[i] = await fn(items[i], i);
      }
    })
  );
  return out;
}

export class PublicBeehiivAdapter implements ContentAdapter {
  readonly name = "public";
  private baseUrl: string;
  private cacheDir?: string;
  private concurrency: number;

  constructor(opts: PublicAdapterOptions = {}) {
    this.baseUrl = (opts.baseUrl || "https://blog.telluscoop.com").replace(/\/$/, "");
    this.cacheDir = opts.cacheDir;
    this.concurrency = opts.concurrency ?? 6;
  }

  async listSlugs(): Promise<string[]> {
    const xml = await get(`${this.baseUrl}/sitemap.xml`);
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    const slugs = locs
      .map((u) => u.match(/\/p\/([^/?#]+)/)?.[1])
      .filter((s): s is string => !!s);
    return [...new Set(slugs)];
  }

  private async fetchRaw(slug: string, force: boolean): Promise<{ meta: BeehiivPost; body: string; publication?: any } | null> {
    const cacheFile = this.cacheDir ? path.join(this.cacheDir, `${slug}.json`) : null;
    if (cacheFile && !force) {
      try {
        return JSON.parse(await fs.readFile(cacheFile, "utf8"));
      } catch {}
    }
    const html = await get(`${this.baseUrl}/p/${slug}`);
    const remix = extractRemix(html);
    const data = remix?.state?.loaderData?.["routes/p/$slug"];
    const meta = data?.post;
    if (!meta) return null;
    const $ = cheerio.load(html);
    const body = $("#content-blocks").html() || "";
    // Recortamos post_theme (17 KB de estilos que no usamos)
    const { post_theme: _pt, tiptap_state: _ts, ...slim } = meta;
    void _pt; void _ts;
    const pub = data.publication
      ? {
          name: data.publication.name,
          description: data.publication.description,
          url: data.publication.url,
          twitter_url: data.publication.twitter_url,
          instagram_url: data.publication.instagram_url,
          linkedin_url: data.publication.linkedin_url,
          youtube_url: data.publication.youtube_url,
          discord_url: data.publication.discord_url,
        }
      : undefined;
    const raw = { meta: slim, body, publication: pub };
    if (cacheFile) {
      await fs.mkdir(path.dirname(cacheFile), { recursive: true });
      await fs.writeFile(cacheFile, JSON.stringify(raw));
    }
    return raw;
  }

  async fetchSnapshot(opts: { force?: boolean; log?: (m: string) => void } = {}): Promise<ContentSnapshot> {
    const log = opts.log || (() => {});
    const slugs = await this.listSlugs();
    log(`sitemap: ${slugs.length} posts`);
    let pubRaw: any;
    const posts = (
      await pool(slugs, this.concurrency, async (slug, i) => {
        try {
          const raw = await this.fetchRaw(slug, !!opts.force);
          if (!raw) {
            log(`  ! sin datos: ${slug}`);
            return null;
          }
          if (raw.publication && !pubRaw) pubRaw = raw.publication;
          if ((i + 1) % 20 === 0) log(`  ${i + 1}/${slugs.length}`);
          return this.toPost(slug, raw.meta, raw.body);
        } catch (e) {
          log(`  ! error ${slug}: ${(e as Error).message}`);
          return null;
        }
      })
    ).filter((p): p is Post => !!p && !!p.title);

    posts.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

    // Slugs limpios únicos + mapa de redirecciones
    const taken = new Set(posts.map((p) => p.sourceSlug));
    const redirects: Record<string, string> = {};
    for (const p of posts) {
      let clean = repairSlug(p.sourceSlug, p.title);
      if (!clean) clean = repairByWords(p.sourceSlug, `${p.title} ${p.subtitle} ${p.html.replace(/<[^>]+>/g, " ")}`);
      if (!clean && looksBroken(p.sourceSlug, p.title)) clean = slugify(p.title).slice(0, 100).replace(/-+$/, "");
      if (clean && clean !== p.sourceSlug && !taken.has(clean)) {
        taken.add(clean);
        redirects[p.sourceSlug] = clean;
        p.slug = clean;
      }
    }

    const publication: Publication = {
      name: pubRaw?.name || "Tellus Cooperative",
      description: pubRaw?.description || "La Cooperativa Blockchain de LatAm",
      url: process.env.NEXT_PUBLIC_SITE_URL || "https://telluscoop.org",
      social: {
        x: pubRaw?.twitter_url || undefined,
        instagram: pubRaw?.instagram_url || undefined,
        linkedin: pubRaw?.linkedin_url || undefined,
        youtube: pubRaw?.youtube_url || undefined,
        discord: pubRaw?.discord_url || undefined,
      },
    };
    return { generatedAt: new Date().toISOString(), source: this.name, publication, posts, redirects };
  }

  private toPost(slug: string, m: BeehiivPost, body: string): Post {
    const title: string = (m.web_title || m.meta_default_title || "").trim();
    const subtitle: string = (m.web_subtitle || "").trim();
    const { html, toc, text } = normalizeBeehiivHtml(body, { title, subtitle });
    const authors: Author[] = (m.authors || []).map((a: any) => ({
      name: a.name,
      avatar: a.profile_picture?.thumb?.url || a.profile_picture?.url || undefined,
      bio: a.bio || undefined,
      twitter: a.twitter_handle || undefined,
    }));
    const tags: Tag[] = (m.content_tags || []).map((t: any) => ({ slug: t.slug || slugify(t.display), name: t.display }));
    return {
      slug: m.slug || slug,
      sourceSlug: m.slug || slug,
      title,
      subtitle,
      description: (m.meta_default_description || subtitle || text.slice(0, 160)).trim(),
      publishedAt: new Date(m.override_scheduled_at || m.created_at).toISOString(),
      updatedAt: m.updated_at ? new Date(m.updated_at).toISOString() : undefined,
      image: m.image_url
        ? { url: m.image_url, width: m.image_width || undefined, height: m.image_height || undefined, alt: title }
        : undefined,
      authors,
      tags,
      readingMinutes: m.estimated_reading_time || Math.max(1, Math.round(text.split(" ").length / 220)),
      featured: !!m.featured,
      excerpt: text.slice(0, 280),
      html,
      toc,
    };
  }
}
