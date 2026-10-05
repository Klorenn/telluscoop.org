/**
 * Original Tellus illustrations — brand palette only.
 * Not Milk Road art; not the LATAM map; not the planetas-botas trio.
 */
export const ILLUSTRATIONS = {
  hero: "/brand/illo-hero.svg",
  subscribe: "/brand/illo-subscribe.svg",
  archive: "/brand/illo-archive.svg",
  hub: "/brand/illo-hub.svg",
  stellar: "/brand/illo-stellar.svg",
  educacion: "/brand/illo-learn.svg",
  blockchain: "/brand/illo-chain.svg",
  ia: "/brand/illo-spark.svg",
  community: "/brand/illo-coop.svg",
} as const;

export type IllustrationName = keyof typeof ILLUSTRATIONS;

export const TAG_ILLUSTRATIONS: Record<string, IllustrationName> = {
  "stellar-en-espanol": "stellar",
  educacion: "educacion",
  blockchain: "blockchain",
  ia: "ia",
  "community-writers": "community",
};

export default function Illustration({
  name,
  className = "h-16 w-16",
  alt = "",
}: {
  name: IllustrationName;
  className?: string;
  alt?: string;
}) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={ILLUSTRATIONS[name]} alt={alt} className={className} decoding="async" />;
}
