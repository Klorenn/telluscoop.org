/** Pau-approved comic planet mascots + remaining Figma pack.
 *  No banned Earth/robot/line-art in chrome. Pastillas mascot stays out of these slots.
 *  Illustrated LATAM map lives in MapBand, not here. */
export const CHARACTERS = {
  "robot-espacio": { src: "/brand/personaje-robot-espacio.png", width: 900, height: 900 },
  "planetas-botas": { src: "/brand/personaje-planetas-botas.png", width: 800, height: 669 },
  blockchain: { src: "/brand/mascota-blockchain-bloques.png", width: 1200, height: 1001 },
  ia: { src: "/brand/mascota-ia-cyborg.png", width: 1200, height: 1001 },
  emprendimiento: { src: "/brand/mascota-emprendimiento-astronauta.png", width: 1200, height: 1001 },
  cursos: { src: "/brand/mascota-cursos-profesor.png", width: 1200, height: 1001 },
  pro: { src: "/brand/mascota-pro-candado.png", width: 1920, height: 1920 },
} as const;

export type CharacterName = keyof typeof CHARACTERS;

export const TAG_CHARACTERS: Record<string, CharacterName> = {
  blockchain: "blockchain",
  ia: "ia",
  emprendimiento: "emprendimiento",
  cursos: "cursos",
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
