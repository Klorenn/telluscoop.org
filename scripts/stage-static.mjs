/**
 * Copies existing static apps into public/ so Next.js can serve them
 * without moving the source trees that tests and local tooling still use.
 */
import { cpSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const destRoot = path.join(root, "public");

const dirs = ["ops", "hub", "resources", "tools", "merch", "stellar", "uploads", "Hubs", "BRAND"];
const files = ["brand.html", "llms.txt", "hub.html"];

mkdirSync(destRoot, { recursive: true });

for (const dir of dirs) {
  const from = path.join(root, dir);
  if (!existsSync(from)) continue;
  cpSync(from, path.join(destRoot, dir), { recursive: true, dereference: true });
}

for (const file of files) {
  const from = path.join(root, file);
  if (!existsSync(from)) continue;
  cpSync(from, path.join(destRoot, file));
}

console.log("[stage-static] copied existing Tellus pages into public/");
