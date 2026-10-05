export const SITE = {
  name: "Tellus Cooperative",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://telluscoop.org",
  title: "Tellus Cooperative — Aprende, conecta y emprende en Web3 desde LATAM",
  description:
    "Noticias, cursos y herramientas para entender blockchain, Stellar y Web3. Todo en español, directo a tu correo. La cooperativa blockchain de Latinoamérica.",
  locale: "es_CL",
  twitter: "@telluscoop",
  ogImage: "/brand/og-default.jpg",
};

export const isProductionIndexable = process.env.SITE_ENV === "production";

/** Nombres "bonitos" para las categorías de Beehiiv (content tags). */
export const TAG_LABELS: Record<string, string> = {
  "stellar-en-espanol": "Stellar en español",
  "community-writers": "Community Writers",
  "boletin-semanal": "Boletín semanal",
  "trabajos-web-3": "Trabajos Web3",
  ia: "Inteligencia artificial",
  educacion: "Educación",
  informacion: "Información",
  invitacion: "Invitaciones",
};
export const tagLabel = (t: { slug: string; name: string }) => TAG_LABELS[t.slug] || t.name;

/** Filas de categorías en la portada (en este orden). */
export const HOME_ROWS = ["stellar-en-espanol", "educacion", "blockchain", "ia", "community-writers"];

const fmt = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Santiago" });
const fmtShort = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Santiago" });
export const formatDate = (iso: string) => fmt.format(new Date(iso));
export const formatDateShort = (iso: string) => fmtShort.format(new Date(iso)).replace(".", "");
export const absUrl = (p: string) => new URL(p, SITE.url).toString();
