import type { ContentAdapter } from "./types";
import { PublicBeehiivAdapter } from "./adapters/public";
import { BeehiivApiAdapter } from "./adapters/beehiiv-api";

/** Elige el adaptador: CONTENT_SOURCE=public|beehiivApi (por defecto "public"). */
export function getAdapter(cacheDir: string): ContentAdapter {
  const src = process.env.CONTENT_SOURCE || "public";
  if (src === "beehiivApi") {
    const api = new BeehiivApiAdapter();
    if (api.isConfigured()) return api;
    console.warn("[content] CONTENT_SOURCE=beehiivApi but missing BEEHIIV_API_KEY; using public");
  }
  return new PublicBeehiivAdapter({ cacheDir });
}
