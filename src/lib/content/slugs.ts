/** Utilidades de slugs: limpieza de acentos y reparación de slugs rotos de Beehiiv. */

export function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function slugify(s: string): string {
  return stripAccents(s.toLowerCase())
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const isAlnum = (c: string) => /^[a-z0-9]$/.test(c);
const accentBase = (c: string) => {
  const b = stripAccents(c);
  return b !== c && isAlnum(b) ? b : null;
};

/**
 * Beehiiv generó algunos slugs reemplazando cada letra acentuada por "-"
 * (ej. "Inauguración" -> "inauguraci-n"). Recorremos slug y título a la vez y,
 * donde el título tiene una letra acentuada y el slug un guion, ponemos la letra
 * base. Devuelve el slug reparado, o null si no hay nada que reparar o si slug y
 * título no se pueden alinear con seguridad.
 */
export function repairSlug(sourceSlug: string, title: string): string | null {
  const s = sourceSlug;
  const t = [...title.toLowerCase().normalize("NFC")];
  let i = 0;
  let j = 0;
  let out = "";
  let changed = false;
  while (i < s.length) {
    if (j >= t.length) return null;
    const tc = t[j];
    const sc = s[i];
    if (isAlnum(tc)) {
      if (sc !== tc) return null;
      out += sc;
      i++;
      j++;
      continue;
    }
    const base = accentBase(tc);
    if (base) {
      if (sc !== "-") return null;
      out += base;
      changed = true;
      i++;
      j++;
      // Si tras la letra acentuada viene un separador que Beehiiv colapsó con este guion,
      // reponemos el guion.
      let k = j;
      while (k < t.length && !isAlnum(t[k]) && !accentBase(t[k])) k++;
      if (k > j && i < s.length && s[i] !== "-") out += "-";
      if (k > j) j = k;
      continue;
    }
    // separador / puntuación en el título
    if (sc === "-") {
      if (!out.endsWith("-") && out.length) out += "-";
      i++;
      while (j < t.length && !isAlnum(t[j]) && !accentBase(t[j])) j++;
      continue;
    }
    j++; // Beehiiv omitió este carácter
  }
  if (!changed) return null;
  const cleaned = out.replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned && cleaned !== sourceSlug ? cleaned : null;
}

/** Heurística para detectar slugs con acentos rotos aunque no se puedan alinear. */
export function looksBroken(sourceSlug: string, title: string): boolean {
  return /[áéíóúñü]/i.test(title) && /(^|-)[a-z]{1,}-[a-z]{1,2}(-|$)/.test(sourceSlug);
}

/**
 * Plan B cuando el slug no coincide con el título (p. ej. el slug tiene un prefijo
 * distinto): reparamos palabra a palabra usando las palabras acentuadas del texto.
 * "prep-rate" + palabra "prepárate" en el texto -> "preparate".
 */
export function repairByWords(sourceSlug: string, text: string): string | null {
  const words = text.toLowerCase().normalize("NFC").split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const plain = new Set(words.map((w) => stripAccents(w)).filter((w) => isAlnumWord(w)));
  const brokenMap = new Map<string, string>(); // forma rota -> forma limpia
  for (const w of words) {
    if (!/[^\x00-\x7f]/.test(w)) continue;
    const clean = stripAccents(w);
    // forma NFC: "inauguración" -> "inauguraci-n"; forma NFD: "edición" -> "edicio-n"
    let nfc = "";
    for (const ch of w) nfc += isAlnum(ch) ? ch : "-";
    let nfd = "";
    for (const ch of w.normalize("NFD")) nfd += isAlnum(ch) ? ch : "-";
    for (const f of [nfc, nfd]) {
      const broken = f.replace(/-+/g, "-");
      brokenMap.set(broken, clean);
      // acento inicial colapsado con el guion anterior: "único" -> "nico"
      if (broken.startsWith("-")) brokenMap.set(broken.slice(1), clean);
    }
  }
  const tokens = sourceSlug.split("-");
  const out: string[] = [];
  let changed = false;
  for (let i = 0; i < tokens.length; ) {
    let matched = false;
    for (let L = Math.min(4, tokens.length - i); L >= 2; L--) {
      const joined = tokens.slice(i, i + L).join("-");
      const hit = brokenMap.get(joined);
      if (hit) {
        out.push(hit);
        i += L;
        matched = changed = true;
        break;
      }
    }
    if (matched) continue;
    // acento al final de palabra: "cerr" (cerró), "dej" (dejó)
    const tok = tokens[i];
    const endHit = brokenMap.get(tok + "-") ?? (plain.has(tok) ? undefined : brokenMap.get(tok));
    if (endHit && !plain.has(tok)) {
      out.push(endHit);
      changed = true;
    } else out.push(tok);
    i++;
  }
  if (!changed) return null;
  const s = out.join("-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  return s !== sourceSlug ? s : null;
}
function isAlnumWord(w: string) {
  return /^[a-z0-9]+$/.test(w);
}
