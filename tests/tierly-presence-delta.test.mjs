import test from "node:test";
import assert from "node:assert/strict";
import { playingGames, presenceDelta } from "../discord-bot/presence-delta.mjs";

const playing = (name) => ({ name, type: 0 });
const streaming = (name) => ({ name, type: 1 });
const listening = (name) => ({ name, type: 2 });
const custom = (name) => ({ name, type: 4 });
const competing = (name) => ({ name, type: 5 });
const presence = (...activities) => ({ activities });

test("solo considera actividades de tipo Playing", () => {
  const current = presence(
    playing("Fortnite"),
    streaming("Twitch"),
    listening("Spotify"),
    custom("hola"),
    competing("League of Legends"),
  );

  assert.deepEqual(playingGames(current), ["Fortnite"]);
});

test("presence nula o sin actividades no rompe", () => {
  assert.deepEqual(playingGames(null), []);
  assert.deepEqual(playingGames(presence()), []);
  assert.deepEqual(playingGames({ activities: null }), []);
});

test("deduplica nombres y elimina espacios exteriores", () => {
  const current = presence(playing(" Fortnite "), playing("Fortnite"), playing("Valorant"));

  assert.deepEqual(playingGames(current), ["Fortnite", "Valorant"]);
});

test("empezar un juego produce un started", () => {
  assert.deepEqual(
    presenceDelta(presence(), presence(playing("Valorant"))),
    { started: ["Valorant"], stopped: [] },
  );
});

test("dejar un juego produce un stopped", () => {
  assert.deepEqual(
    presenceDelta(presence(playing("Valorant")), presence()),
    { started: [], stopped: ["Valorant"] },
  );
});

test("cambiar de juego produce ambos deltas", () => {
  const delta = presenceDelta(presence(playing("Valorant")), presence(playing("Fortnite")));

  assert.deepEqual(delta, { started: ["Fortnite"], stopped: ["Valorant"] });
});

test("seguir en el mismo juego no produce nada", () => {
  assert.deepEqual(
    presenceDelta(presence(playing("Fortnite")), presence(playing("Fortnite"))),
    { started: [], stopped: [] },
  );
});

test("cambiar solo una actividad no Playing no produce nada", () => {
  const before = presence(playing("Fortnite"), listening("canción A"));
  const after = presence(playing("Fortnite"), listening("canción B"));

  assert.deepEqual(presenceDelta(before, after), { started: [], stopped: [] });
});

test("oldPresence indefinido trata todo como started", () => {
  assert.deepEqual(
    presenceDelta(undefined, presence(playing("Rocket League"))),
    { started: ["Rocket League"], stopped: [] },
  );
});
