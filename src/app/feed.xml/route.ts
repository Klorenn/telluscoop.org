import { getAllPosts, getPublication } from "@/lib/content";
import { absUrl, SITE, tagLabel } from "@/lib/site";

export const dynamic = "force-static";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function GET() {
  const pub = getPublication();
  const posts = getAllPosts().slice(0, 30);
  const items = posts
    .map((p) => {
      const url = absUrl(`/p/${p.slug}`);
      return `    <item>
      <title>${esc(p.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${new Date(p.publishedAt).toUTCString()}</pubDate>
      ${p.authors.map((a) => `<dc:creator>${esc(a.name)}</dc:creator>`).join("")}
      ${p.tags.map((t) => `<category>${esc(tagLabel(t))}</category>`).join("")}
      <description>${esc(p.subtitle || p.description)}</description>
      ${p.image ? `<enclosure url="${esc(p.image.url)}" type="image/${/\.png/i.test(p.image.url) ? "png" : "jpeg"}" length="0"/>` : ""}
      <content:encoded><![CDATA[${p.html.replace(/]]>/g, "]]]]><![CDATA[>")}]]></content:encoded>
    </item>`;
    })
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${esc(pub.name)}</title>
    <link>${SITE.url}</link>
    <description>${esc(SITE.description)}</description>
    <language>es</language>
    <atom:link href="${absUrl("/feed.xml")}" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${new Date(posts[0]?.publishedAt || Date.now()).toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;
  return new Response(xml, { headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
