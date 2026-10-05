/**
 * Capa de contenido en runtime/build: SOLO lee la caché generada por
 * scripts/sync-content.ts (content/cache/snapshot.json). Ninguna página
 * llama a Beehiiv directamente.
 */
import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { ContentSnapshot, Post, PostSummary, Tag } from "./types";

let snap: ContentSnapshot | null = null;

function load(): ContentSnapshot {
  if (!snap) {
    const file = path.join(process.cwd(), "content", "cache", "snapshot.json");
    snap = JSON.parse(readFileSync(file, "utf8")) as ContentSnapshot;
  }
  return snap;
}

export function toSummary(p: Post): PostSummary {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { html, toc, ...rest } = p;
  return rest;
}

export const getPublication = () => load().publication;
export const getAllPosts = (): Post[] => load().posts;
export const getAllSummaries = (): PostSummary[] => load().posts.map(toSummary);
export const getRedirects = () => load().redirects;

export function getPost(slug: string): Post | undefined {
  return load().posts.find((p) => p.slug === slug);
}
export function getPostBySourceSlug(slug: string): Post | undefined {
  return load().posts.find((p) => p.sourceSlug === slug);
}

export function getTags(): Array<Tag & { count: number }> {
  const map = new Map<string, Tag & { count: number }>();
  for (const p of load().posts)
    for (const t of p.tags) {
      const e = map.get(t.slug) || { ...t, count: 0 };
      e.count++;
      map.set(t.slug, e);
    }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

export function getPostsByTag(slug: string): PostSummary[] {
  return getAllSummaries().filter((p) => p.tags.some((t) => t.slug === slug));
}

export function getRelated(post: Post, n = 3): PostSummary[] {
  const tagSet = new Set(post.tags.map((t) => t.slug));
  return getAllSummaries()
    .filter((p) => p.slug !== post.slug)
    .map((p) => ({ p, score: p.tags.filter((t) => tagSet.has(t.slug)).length * 10 - Math.abs(Date.parse(p.publishedAt) - Date.parse(post.publishedAt)) / 8.64e9 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((x) => x.p);
}
