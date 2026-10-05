import type { MetadataRoute } from "next";
import { absUrl, isProductionIndexable } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const prod = isProductionIndexable;
  return {
    rules: prod ? { userAgent: "*", allow: "/" } : { userAgent: "*", disallow: "/" },
    sitemap: absUrl("/sitemap.xml"),
  };
}
