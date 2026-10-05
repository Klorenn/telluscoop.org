export const CHARACTERS = {
  tierra: { src: "/brand/personaje-tierra.webp", width: 900, height: 899 },
  "tierra-corbata": { src: "/brand/personaje-tierra-corbata.webp", width: 674, height: 720 },
  "tierra-traje": { src: "/brand/personaje-tierra-traje.webp", width: 183, height: 183 },
  "robot-teal": { src: "/brand/personaje-robot-teal.webp", width: 771, height: 800 },
  "robot-espacio": { src: "/brand/personaje-robot-espacio.webp", width: 798, height: 800 },
  "planetas-botas": { src: "/brand/personaje-planetas-botas.webp", width: 711, height: 578 },
  greenpill: { src: "/brand/personaje-greenpill-pastillas.webp", width: 682, height: 720 },
  educacion: { src: "/brand/ilustracion-educacion.svg", width: 555, height: 555 },
  inclusion: { src: "/brand/ilustracion-inclusion.svg", width: 755, height: 602 },
  crecimiento: { src: "/brand/ilustracion-crecimiento.svg", width: 812, height: 602 },
} as const;

export type CharacterName = keyof typeof CHARACTERS;

/** Category → mascot, Milk Road-style (one character per section, never all at once). */
export const TAG_CHARACTERS: Record<string, CharacterName> = {
  "stellar-en-espanol": "robot-teal",
  educacion: "educacion",
  blockchain: "inclusion",
  ia: "robot-espacio",
  "community-writers": "tierra-corbata",
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
