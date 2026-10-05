/**
 * Sincroniza el contenido en build: `npm run sync` (se ejecuta en `prebuild`).
 *   --force          re-descarga todos los posts
 *   SKIP_SYNC=1      usa la caché existente sin red
 *   SYNC_MAX_AGE_H   antigüedad máxima de la caché antes de refrescar (def. 6h)
 *   CONTENT_SOURCE   public (default) | beehiivApi
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { getAdapter } from "../src/lib/content/adapters";

const root = path.resolve(import.meta.dirname, "..");
const cacheDir = path.join(root, "content", "cache");
const snapFile = path.join(cacheDir, "snapshot.json");
const force = process.argv.includes("--force");

async function main() {
  const maxAgeH = Number(process.env.SYNC_MAX_AGE_H || 6);
  try {
    const st = await fs.stat(snapFile);
    const ageH = (Date.now() - st.mtimeMs) / 36e5;
    if (process.env.SKIP_SYNC === "1" || (!force && ageH < maxAgeH)) {
      console.log(`[sync] usando caché (${ageH.toFixed(1)} h): ${snapFile}`);
      return;
    }
  } catch {}
  try {
    const adapter = getAdapter(path.join(cacheDir, "raw"));
    console.log(`[sync] adaptador: ${adapter.name}`);
    const snap = await adapter.fetchSnapshot({ force, log: (m) => console.log(`[sync] ${m}`) });
    if (!snap.posts.length) throw new Error("el adaptador no devolvió posts");
    await fs.mkdir(cacheDir, { recursive: true });
    await fs.writeFile(snapFile, JSON.stringify(snap));
    await fs.writeFile(path.join(cacheDir, "redirects.json"), JSON.stringify(snap.redirects, null, 2));
    console.log(`[sync] ${snap.posts.length} posts, ${Object.keys(snap.redirects).length} redirecciones -> ${snapFile}`);
  } catch (err) {
    try {
      await fs.stat(snapFile);
      console.warn(`[sync] falló la red (${(err as Error).message}); usando caché existente`);
      return;
    } catch {
      console.error("[sync] ERROR", err);
      process.exit(1);
    }
  }
}
main();
