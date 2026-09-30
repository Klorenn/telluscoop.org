import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../supabase/migrations/20260930190000_tierly_harden_event_attendance_p1.sql", import.meta.url), "utf8");
const adminJs = readFileSync(new URL("../tierly/admin.js", import.meta.url), "utf8");

test("el check-in exige estado válido y ventana completa", () => {
  assert.match(sql, /status in \('scheduled', 'live'\)/i);
  assert.match(sql, /starts_at is not null/i);
  assert.match(sql, /ends_at is not null/i);
  assert.match(sql, /now\(\) between starts_at and ends_at/i);
});

test("impide reactivar asistencia confirmada y salir tras check-in", () => {
  assert.match(sql, /select confirmed_at[\s\S]*for update/i);
  assert.match(sql, /La asistencia ya fue confirmada/i);
  assert.match(sql, /a\.checked_in_at is null/i);
  assert.match(sql, /a\.confirmed_at is null/i);
});

test("las RPCs P1 conservan el acceso autenticado", () => {
  assert.match(sql, /revoke all on function[\s\S]*from public, anon/i);
  assert.match(sql, /grant execute on function[\s\S]*to authenticated/i);
});

test("la UI no ofrece salir después del check-in o confirmación", () => {
  assert.match(adminJs, /canLeave = mine && !mine\.unregistered_at && !mine\.checked_in_at && !mine\.confirmed_at/);
});
