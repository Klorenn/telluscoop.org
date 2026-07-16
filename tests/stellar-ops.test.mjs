import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../ops/stellar/app.js", import.meta.url), "utf8");
const page = await readFile(new URL("../ops/stellar/index.html", import.meta.url), "utf8");

test("production cache versions match", () => {
  const cssVersion = page.match(/styles\.css\?v=([^"']+)/)?.[1];
  const jsVersion = page.match(/app\.js\?v=([^"']+)/)?.[1];
  assert.ok(cssVersion);
  assert.equal(jsVersion, cssVersion);
});

test("all known Tellus accounts are assignable to programs", () => {
  for (const email of [
    "hola@telluscoop.org",
    "kohcuendepau@gmail.com",
    "bastian@telluscoop.org",
    "mishekoh@gmail.com",
    "kohcuendedani@gmail.com",
    "alexbnjmnch@gmail.com",
    "inboxblessedux@gmail.com",
  ]) assert.match(app, new RegExp(email.replace(".", "\\.")));
});

test("events require and inherit an operational program", () => {
  assert.match(app, /programSelect\.required = true/);
  assert.match(app, /programSelect\.value = state\.selectedProgram/);
});

test("event KPI counts only submitted or accepted work", () => {
  assert.match(app, /\["submitted","accepted"\]\.includes\(item\.status\)/);
  assert.match(app, /Faltan \$\{remaining\} eventos enviados o aceptados/);
  assert.match(app, /data-initiative-filter="qualifying"/);
  assert.match(app, /\["not_started","in_progress","at_risk","submitted","accepted","blocked"\]/);
  assert.match(app, /Calificables/);
  assert.match(app, /Completados/);
  assert.match(app, /Bloqueados/);
});

test("Luma calls refresh an expired session once", () => {
  assert.match(app, /async function invokeEdge/);
  assert.match(app, /supabase\.auth\.refreshSession\(\)/);
});

test("obsolete hamburger menu is absent", () => {
  assert.doesNotMatch(app, /id="menu"/);
  assert.doesNotMatch(page, /id="menu"/);
});
