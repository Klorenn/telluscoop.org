// ActivityType.Playing === 0 en discord.js v14. Solo estas actividades
// representan una sesión de juego para Tierly.
const PLAYING = 0;

/**
 * Devuelve los nombres únicos de juegos visibles en una presencia.
 * El orden de Discord se conserva para que el resultado sea estable.
 */
export function playingGames(presence) {
  if (!Array.isArray(presence?.activities)) return [];

  const names = new Set();
  for (const activity of presence.activities) {
    if (activity?.type !== PLAYING || typeof activity.name !== "string") continue;

    const name = activity.name.trim();
    if (name) names.add(name);
  }

  return [...names];
}

/**
 * Compara dos presencias y devuelve los juegos que se iniciaron o terminaron.
 * El resultado solo contiene nombres de actividades Playing.
 */
export function presenceDelta(oldPresence, newPresence) {
  const before = new Set(playingGames(oldPresence));
  const after = new Set(playingGames(newPresence));

  return {
    started: [...after].filter((name) => !before.has(name)),
    stopped: [...before].filter((name) => !after.has(name)),
  };
}
