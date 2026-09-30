import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../supabase/migrations/20260930201000_tierly_event_reminders.sql", import.meta.url), "utf8");

test("modela recordatorios por guild y evento con estado", () => {
  assert.match(sql, /guild_id text not null references public\.communities/i);
  assert.match(sql, /event_id uuid not null references public\.gaming_events/i);
  assert.match(sql, /status text not null default 'pending'/i);
  assert.match(sql, /unique \(guild_id, event_id, kind, reminder_minutes\)/i);
});

test("genera recordatorios de forma idempotente y solo para estados válidos", () => {
  assert.match(sql, /tierly_generate_event_reminders/i);
  assert.match(sql, /on conflict \(guild_id, event_id, kind, reminder_minutes\) do nothing/i);
  assert.match(sql, /e\.status in \('scheduled', 'live'\)/i);
  assert.match(sql, /e\.starts_at - make_interval\(mins => p_reminder_minutes\)/i);
});

test("cancela pendientes de eventos cancelados o completados", () => {
  assert.match(sql, /tierly_cancel_event_reminders/i);
  assert.match(sql, /e\.status in \('cancelled', 'completed'\)/i);
});

test("el job y la tabla no quedan expuestos al frontend", () => {
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /revoke all on table public\.tierly_event_notifications from anon, authenticated/i);
  assert.match(sql, /tierly-generar-recordatorios/i);
});
