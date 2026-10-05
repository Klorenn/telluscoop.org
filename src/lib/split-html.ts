import * as cheerio from "cheerio";

/**
 * Parte el HTML del artículo tras ~ratio de los <p> de nivel superior
 * (o, si hay pocos, tras ~ratio de nodos de bloque).
 */
export function splitHtmlAtParagraphs(html: string, ratio = 0.4): { before: string; after: string } {
  const $ = cheerio.load(html, undefined, false);
  const children = $.root().children().toArray();
  if (children.length === 0) return { before: html, after: "" };

  const pIndexes: number[] = [];
  children.forEach((el, i) => {
    if ("name" in el && el.name === "p") pIndexes.push(i);
  });

  let cutAfter: number;
  if (pIndexes.length >= 4) {
    const targetP = Math.max(1, Math.floor(pIndexes.length * ratio));
    cutAfter = pIndexes[Math.min(targetP, pIndexes.length - 1)]!;
  } else {
    cutAfter = Math.max(0, Math.floor(children.length * ratio) - 1);
  }

  const before = children.slice(0, cutAfter + 1).map((el) => $.html(el) || "").join("");
  const after = children.slice(cutAfter + 1).map((el) => $.html(el) || "").join("");
  return { before, after };
}
