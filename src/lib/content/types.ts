/**
 * Modelo de contenido normalizado, independiente de la fuente (Beehiiv público,
 * API de Beehiiv, otro CMS). Todo el sitio consume SOLO estos tipos.
 */
export interface Author {
  name: string;
  avatar?: string;
  bio?: string;
  twitter?: string;
}

export interface Tag {
  slug: string;
  name: string;
}

export interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

export interface PostImage {
  url: string;
  width?: number;
  height?: number;
  alt?: string;
}

export interface PostSummary {
  /** Slug canónico (limpio) que usa el nuevo sitio. */
  slug: string;
  /** Slug original en Beehiiv (puede tener acentos rotos, p. ej. "inauguraci-n"). */
  sourceSlug: string;
  title: string;
  subtitle: string;
  description: string;
  publishedAt: string; // ISO
  updatedAt?: string; // ISO
  image?: PostImage;
  authors: Author[];
  tags: Tag[];
  readingMinutes?: number;
  featured?: boolean;
  /** Texto plano corto para búsqueda/extractos. */
  excerpt: string;
}

export interface Post extends PostSummary {
  /** HTML limpio y seguro para renderizar dentro de .prose-tellus */
  html: string;
  toc: TocItem[];
}

export interface Publication {
  name: string;
  description: string;
  url: string;
  social: Partial<Record<"x" | "instagram" | "linkedin" | "youtube" | "discord", string>>;
}

export interface ContentSnapshot {
  generatedAt: string;
  source: string;
  publication: Publication;
  posts: Post[];
  /** Mapa slug original -> slug limpio (solo los que cambian). */
  redirects: Record<string, string>;
}

/**
 * Interfaz que debe implementar cualquier fuente de contenido.
 * Se ejecuta en build (scripts/sync-content.ts) y produce un ContentSnapshot
 * que se guarda en content/cache/. El sitio en runtime solo lee esa caché.
 */
export interface ContentAdapter {
  readonly name: string;
  fetchSnapshot(opts?: { force?: boolean; log?: (msg: string) => void }): Promise<ContentSnapshot>;
}
