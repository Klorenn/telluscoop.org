/** The 404 page is the only place a character appears. */
export const CHARACTERS = {
  "robot-espacio": { src: "/brand/personaje-robot-espacio.webp", width: 798, height: 800 },
} as const;

export type CharacterName = keyof typeof CHARACTERS;

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
