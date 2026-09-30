import test from "node:test";
import assert from "node:assert/strict";
import { normalizeGameName, displayNameFor } from "../discord-bot/game-normalize.mjs";

test("colapsa espacios y mayúsculas al mismo canónico", () => {
  const canon = normalizeGameName("Fortnite");
  assert.equal(normalizeGameName("  Fortnite  "), canon);
  assert.equal(normalizeGameName("FORTNITE"), canon);
  assert.equal(normalizeGameName("Fortnite\u00a0"), canon);
});

test("ignora sufijos de edición comunes", () => {
  const canon = normalizeGameName("Minecraft");
  assert.equal(normalizeGameName("Minecraft: Java Edition"), canon);
  assert.equal(normalizeGameName("Minecraft Bedrock Edition"), canon);
});

test("juegos distintos no colisionan", () => {
  assert.notEqual(normalizeGameName("Valorant"), normalizeGameName("Valheim"));
});

test("el nombre de display conserva la forma legible", () => {
  assert.equal(displayNameFor("  Rocket League  "), "Rocket League");
  assert.equal(displayNameFor("Minecraft: Java Edition"), "Minecraft");
});

test("una entrada vacía o inválida devuelve una cadena vacía", () => {
  assert.equal(normalizeGameName(""), "");
  assert.equal(normalizeGameName(null), "");
  assert.equal(normalizeGameName(undefined), "");
});
