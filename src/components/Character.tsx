/** Real Figma pack only. No invented drawings. */
export const CHARACTERS = {
  tierra: { src: "/brand/personaje-tierra.png", width: 1200, height: 1199 },
  "tierra-corbata": { src: "/brand/personaje-tierra-corbata.png", width: 686, height: 733 },
  "tierra-traje": { src: "/brand/personaje-tierra-traje.png", width: 183, height: 183 },
  "robot-teal": { src: "/brand/personaje-robot-teal.png", width: 800, height: 800 },
  "robot-espacio": { src: "/brand/personaje-robot-espacio.png", width: 900, height: 900 },
  "planetas-botas": { src: "/brand/personaje-planetas-botas.png", width: 800, height: 669 },
  greenpill: { src: "/brand/personaje-greenpill-pastillas.png", width: 726, height: 771 },
  educacion: { src: "/brand/ilustracion-educacion.svg", width: 555, height: 555 },
  inclusion: { src: "/brand/ilustracion-inclusion.svg", width: 755, height: 602 },
  crecimiento: { src: "/brand/ilustracion-crecimiento.svg", width: 812, height: 602 },
} as const;

export type CharacterName = keyof typeof CHARACTERS;

/** Category rows that have a fitting Figma illustration. Others stay typographic. */
export const TAG_CHARACTERS: Record<string, CharacterName> = {
  educacion: "educacion",
  blockchain: "inclusion",
  "community-writers": "crecimiento",
};

export default function Character({
  name,
  className = "h-28 w-auto",
  alt = "",
  fetchPriority,
}: {
  name: CharacterName;
  className?: string;
  alt?: string;
  fetchPriority?: "high" | "low" | "auto";
}) {
  const c = CHARACTERS[name];
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={c.src}
      alt={alt}
      width={c.width}
      height={c.height}
      className={className}
      decoding="async"
      fetchPriority={fetchPriority}
    />
  );
}
