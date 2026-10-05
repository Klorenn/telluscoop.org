import type { MetadataRoute } from "next";
import { getAllPosts, getTags } from "@/lib/content";
import { absUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllPosts();
  return [
    { url: absUrl("/"), lastModified: posts[0]?.publishedAt, changeFrequency: "daily", priority: 1 },
    { url: absUrl("/archive"), lastModified: posts[0]?.publishedAt, changeFrequency: "daily", priority: 0.8 },
    ...getTags().map((t) => ({ url: absUrl(`/t/${t.slug}`), changeFrequency: "weekly" as const, priority: 0.6 })),
    ...posts.map((p) => ({ url: absUrl(`/p/${p.slug}`), lastModified: p.updatedAt || p.publishedAt, changeFrequency: "monthly" as const, priority: 0.7 })),
  ];
}
