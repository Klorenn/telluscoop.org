"use client";
/**
 * Loader de next/image: las imágenes de Beehiiv se redimensionan en su propio CDN
 * (Cloudflare Images en media.beehiiv.com), así no gastamos optimización de Vercel.
 * Los assets locales (/brand/*) ya están optimizados a mano.
 */
export default function loader({ src, width, quality }: { src: string; width: number; quality?: number }) {
  const m = src.match(/(?:beehiiv-images-production\.s3\.amazonaws\.com|media\.beehiiv\.com\/cdn-cgi\/image\/[^/]+)\/(uploads\/[^?]+)/);
  if (m) return `https://media.beehiiv.com/cdn-cgi/image/format=auto,width=${width},quality=${quality || 70}/${m[1]}`;
  return src;
}
