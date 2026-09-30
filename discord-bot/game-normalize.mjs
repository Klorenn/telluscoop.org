// Los nombres de actividad de Discord llegan sucios y variables.
// La normalización evita separar un mismo juego en varias tendencias.

const EDITION_SUFFIX = /\s*[:\-]?\s*\b(java|bedrock|deluxe|goty|remastered|definitive|legacy|standard)\b.*$/i;
const TRAILING_EDITION = /\s*\bedition\b.*$/i;

function clean(raw) {
  if (typeof raw !== "string") return "";

  return raw
    .replace(/[\u00a0\u2007\u202f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(TRAILING_EDITION, "")
    .replace(EDITION_SUFFIX, "")
    .trim();
}

export function displayNameFor(raw) {
  return clean(raw);
}

export function normalizeGameName(raw) {
  return clean(raw).toLowerCase();
}
