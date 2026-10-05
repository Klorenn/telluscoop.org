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
  events: "/brand/illo-events.svg",
} as const;

export type IllustrationName = keyof typeof ILLUSTRATIONS;

const DIM: Record<IllustrationName, [number, number]> = {
  hero: [800, 640],
  subscribe: [420, 420],
  archive: [320, 320],
  hub: [640, 400],
  stellar: [128, 128],
  educacion: [128, 128],
  blockchain: [128, 128],
  ia: [128, 128],
  community: [128, 128],
  events: [128, 128],
};

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
  const [w, h] = DIM[name];
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={ILLUSTRATIONS[name]}
      alt={alt}
      width={w}
      height={h}
      className={className}
      decoding="async"
    />
  );
}
