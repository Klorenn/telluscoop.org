/**
 * Adaptador "beehiivApi": lee posts vía API v2 (solo lectura).
 *
 * Env:
 *   BEEHIIV_API_KEY
 *   BEEHIIV_PUBLICATION_ID  (pub_…)
 *
 * GET /v2/publications/{pub}/posts
 *   ?status=confirmed&expand[]=free_web_content&limit=100&page=N
 *   &order_by=publish_date&direction=desc
 *
 * No escribe nada en Beehiiv. Suscripciones van en /api/subscribe.
 */
import type { Author, ContentAdapter, ContentSnapshot, Post, Publication, Tag } from "../types";
import { normalizeBeehiivHtml } from "../normalize";
import { looksBroken, repairByWords, repairSlug, slugify } from "../slugs";

type ApiPost = {
  id?: string;
  title?: string;
  subtitle?: string;
  slug?: string;
  authors?: string[] | Array<{ name?: string; profile_picture?: { url?: string }; bio?: string; twitter_handle?: string }>;
  content_tags?: Array<string | { slug?: string; display?: string; name?: string }>;
  thumbnail_url?: string;
  web_url?: string;
  publish_date?: number;
  displayed_date?: number;
  created?: number;
  meta_default_title?: string;
  meta_default_description?: string;
  audience?: string;
  platform?: string;
  status?: string;
  content?: { free?: { web?: string }; premium?: { web?: string } };
};

type ListResponse = {
  data?: ApiPost[];
  limit?: number;
  page?: number;
  total_results?: number;
  total_pages?: number;
};

async function beehiivGet(path: string, apiKey: string): Promise<unknown> {
  const res = await fetch(`https://api.beehiiv.com/v2${path}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`beehiivApi ${res.status} ${path}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

function tagFrom(t: string | { slug?: string; display?: string; name?: string }): Tag {
  if (typeof t === "string") return { slug: slugify(t), name: t };
  const name = t.display || t.name || t.slug || "";
  return { slug: t.slug || slugify(name), name };
}

function authorFrom(a: string | { name?: string; profile_picture?: { url?: string }; bio?: string; twitter_handle?: string }): Author {
  if (typeof a === "string") return { name: a };
  return {
    name: a.name || "Tellus Cooperative",
    avatar: a.profile_picture?.url,
    bio: a.bio,
    twitter: a.twitter_handle,
  };
}

export class BeehiivApiAdapter implements ContentAdapter {
  readonly name = "beehiivApi";
  constructor(
    private apiKey = process.env.BEEHIIV_API_KEY,
    private publicationId = process.env.BEEHIIV_PUBLICATION_ID || "pub_30c7e4c1-15ed-46d8-a23d-32c90e011794",
  ) {}

  isConfigured(): boolean {
    return !!(this.apiKey?.trim() && this.publicationId?.trim());
  }

  async fetchSnapshot(opts: { force?: boolean; log?: (m: string) => void } = {}): Promise<ContentSnapshot> {
    const log = opts.log || (() => {});
    if (!this.isConfigured()) {
      throw new Error("beehiivApi: faltan BEEHIIV_API_KEY / BEEHIIV_PUBLICATION_ID");
    }
    const apiKey = this.apiKey!.trim();
    const pubId = this.publicationId!.trim();

    // Publication metadata (read-only)
    let publication: Publication = {
      name: "Tellus Cooperative",
      description: "La Cooperativa Blockchain de LatAm",
      url: process.env.NEXT_PUBLIC_SITE_URL || "https://telluscoop.org",
      social: {},
    };
    try {
      const pubRes = (await beehiivGet(`/publications/${pubId}`, apiKey)) as { data?: Record<string, unknown> };
      const d = pubRes.data || {};
      publication = {
        name: String(d.name || publication.name),
        description: String(d.description || publication.description),
        url: String(d.url || d.site_domain || publication.url),
        social: {
          x: (d.twitter_url as string) || undefined,
          instagram: (d.instagram_url as string) || undefined,
          linkedin: (d.linkedin_url as string) || undefined,
          youtube: (d.youtube_url as string) || undefined,
          discord: (d.discord_url as string) || undefined,
        },
      };
    } catch (e) {
      log(`  ! publication meta: ${(e as Error).message}`);
    }

    const posts: Post[] = [];
    let page = 1;
    let totalPages = 1;
    do {
      const qs =
        `?status=confirmed&limit=100&page=${page}` +
        `&order_by=publish_date&direction=desc` +
        `&expand[]=free_web_content`;
      const list = (await beehiivGet(`/publications/${pubId}/posts${qs}`, apiKey)) as ListResponse;
      const batch = list.data || [];
      totalPages = list.total_pages || 1;
      log(`  API page ${page}/${totalPages}: ${batch.length} posts`);
      for (const raw of batch) {
        const post = this.toPost(raw);
        if (post?.title) posts.push(post);
      }
      page += 1;
    } while (page <= totalPages);

    posts.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

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

    return {
      generatedAt: new Date().toISOString(),
      source: this.name,
      publication,
      posts,
      redirects,
    };
  }

  private toPost(m: ApiPost): Post | null {
    const sourceSlug = (m.slug || "").trim();
    if (!sourceSlug) return null;
    const title = (m.meta_default_title || m.title || "").trim();
    const subtitle = (m.subtitle || "").trim();
    const body = m.content?.free?.web || "";
    const { html, toc, text } = normalizeBeehiivHtml(body, { title, subtitle });
    const authors: Author[] = (m.authors || []).map(authorFrom);
    const tags: Tag[] = (m.content_tags || []).map(tagFrom);
    const epoch = m.displayed_date || m.publish_date || m.created;
    const publishedAt = epoch ? new Date(epoch * 1000).toISOString() : new Date().toISOString();
    return {
      slug: sourceSlug,
      sourceSlug,
      title,
      subtitle,
      description: (m.meta_default_description || subtitle || text.slice(0, 160)).trim(),
      publishedAt,
      image: m.thumbnail_url ? { url: m.thumbnail_url, alt: title } : undefined,
      authors,
      tags,
      readingMinutes: Math.max(1, Math.round(text.split(/\s+/).filter(Boolean).length / 220)),
      excerpt: text.slice(0, 280),
      html,
      toc,
    };
  }
}
